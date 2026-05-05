/**
 * Precompute Mercari market index from the full 1.4M dataset.
 * Output: backend/data/models/mercari_market_index.json (~10-20MB)
 *
 * Run after training:
 *   node backend/scripts/precomputeMercariIndex.js
 *
 * The index contains:
 *   - Market stats per category (and per category+brand)
 *   - A curated representative sample per category for comparable matching
 *
 * This file is committed to git and used in production instead of the full dataset.
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { streamMercariProducts } from '../services/mercariDataLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '../data/models/mercari_market_index.json');

// Max representative samples stored per category (for comparable matching at runtime)
const MAX_SAMPLES_PER_CATEGORY = 500;
// Max samples per condition per category (ensures condition diversity)
const MAX_PER_CONDITION = 100;

const CONDITIONS = ['Brand New', 'Like New', 'Lightly Used', 'Used', 'Heavily Used'];

function trimOutliers(sorted) {
    const lo = Math.floor(sorted.length * 0.10);
    const hi = Math.ceil(sorted.length * 0.90);
    return sorted.slice(lo, hi);
}

async function main() {
    console.log('Streaming full Mercari dataset to build market index...');

    // Accumulators
    // stats[category] = { prices[], brandCounts{}, conditionPrices{ cond: prices[] } }
    const stats = {};
    // brandStats[`${category}::${brand}`] = { prices[], conditionPrices{} }
    const brandStats = {};
    // samples[category][condition] = product[] (capped at MAX_PER_CONDITION)
    const samples = {};

    let total = 0;

    await streamMercariProducts((product) => {
        const { category, brand, condition, price, name, description } = product;
        if (!category || !price) return;

        total++;

        // ── category stats ───────────────────────────────────────────────────
        if (!stats[category]) {
            stats[category] = { prices: [], brandCounts: {}, conditionPrices: {} };
        }
        stats[category].prices.push(price);
        if (brand && brand !== 'Unknown') {
            stats[category].brandCounts[brand] = (stats[category].brandCounts[brand] || 0) + 1;
        }
        if (!stats[category].conditionPrices[condition]) stats[category].conditionPrices[condition] = [];
        stats[category].conditionPrices[condition].push(price);

        // ── brand-level stats ────────────────────────────────────────────────
        if (brand && brand !== 'Unknown') {
            const key = `${category}::${brand}`;
            if (!brandStats[key]) brandStats[key] = { prices: [], conditionPrices: {} };
            brandStats[key].prices.push(price);
            if (!brandStats[key].conditionPrices[condition]) brandStats[key].conditionPrices[condition] = [];
            brandStats[key].conditionPrices[condition].push(price);
        }

        // ── representative samples ───────────────────────────────────────────
        if (!samples[category]) {
            samples[category] = {};
            for (const c of CONDITIONS) samples[category][c] = [];
        }
        const bucket = samples[category][condition];
        if (bucket && bucket.length < MAX_PER_CONDITION && name && price > 0) {
            bucket.push({
                name,
                description: (description || '').slice(0, 200),
                brand: brand || 'Unknown',
                condition,
                price,
                categoryHierarchy: product.categoryHierarchy || [],
                keywords: product.keywords || [],
            });
        }
    });

    console.log(`Streamed ${total.toLocaleString()} products. Building index...`);

    // ── Compile market stats ─────────────────────────────────────────────────
    function compileStats(acc, cat, brand) {
        const sorted = [...acc.prices].sort((a, b) => a - b);
        const trimmed = trimOutliers(sorted);
        const avg = sorted.reduce((s, p) => s + p, 0) / sorted.length;
        const trimmedAvg = trimmed.length
            ? trimmed.reduce((s, p) => s + p, 0) / trimmed.length : avg;
        const median = sorted[Math.floor(sorted.length / 2)];

        const conditionPrices = {};
        for (const [cond, prices] of Object.entries(acc.conditionPrices)) {
            if (prices.length === 0) continue;
            const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
            conditionPrices[cond] = { avg: Math.round(avg), count: prices.length };
        }

        const newPrice = conditionPrices['Brand New']?.avg;
        const depreciation = newPrice
            ? Object.fromEntries(
                Object.entries(conditionPrices).map(([c, d]) => [c, d.avg / newPrice])
              )
            : { 'Brand New': 1.0, 'Like New': 0.85, 'Lightly Used': 0.70, 'Used': 0.55, 'Heavily Used': 0.35 };

        return {
            category: cat,
            brand: brand || null,
            totalItems: sorted.length,
            avgPrice: Math.round(avg),
            trimmedAvgPrice: Math.round(trimmedAvg),
            medianPrice: Math.round(median),
            priceRange: { min: sorted[0], max: sorted[sorted.length - 1] },
            conditionPrices,
            depreciation,
        };
    }

    const categoryStats = {};
    for (const [cat, acc] of Object.entries(stats)) {
        const topBrands = Object.entries(acc.brandCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([b]) => b);
        categoryStats[cat] = { ...compileStats(acc, cat, null), topBrands };
    }

    const brandLevelStats = {};
    for (const [key, acc] of Object.entries(brandStats)) {
        if (acc.prices.length < 5) continue; // skip sparse brand+category combos
        brandLevelStats[key] = compileStats(...[acc, ...key.split('::')]);
    }

    // ── Flatten samples (cap total per category) ─────────────────────────────
    const flatSamples = {};
    for (const [cat, condBuckets] of Object.entries(samples)) {
        const all = Object.values(condBuckets).flat();
        // Shuffle so we get condition diversity in the slice
        for (let i = all.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [all[i], all[j]] = [all[j], all[i]];
        }
        flatSamples[cat] = all.slice(0, MAX_SAMPLES_PER_CATEGORY);
    }

    const index = {
        builtAt: new Date().toISOString(),
        totalProducts: total,
        categoryStats,
        brandLevelStats,
        samples: flatSamples,
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index));
    const sizeMB = (fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(1);
    console.log(`✅ Market index written to ${OUTPUT_PATH} (${sizeMB} MB)`);
    console.log(`   Categories: ${Object.keys(categoryStats).length}`);
    console.log(`   Brand+category combos: ${Object.keys(brandLevelStats).length}`);
    console.log(`   Sample products: ${Object.values(flatSamples).reduce((s, a) => s + a.length, 0).toLocaleString()}`);
}

main().catch(err => {
    console.error('Precompute failed:', err);
    process.exit(1);
});
