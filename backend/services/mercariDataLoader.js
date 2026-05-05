import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { createReadStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = resolveDataPath('MERCARI_DATASET_PATH', [
    path.join(__dirname, '../data/train.tsv'),
    path.join(process.cwd(), 'backend/data/train.tsv'),
    path.join(process.cwd(), 'data/train.tsv')
]);
const PROCESSED_DATA_PATH = resolveDataPath('MERCARI_PROCESSED_DATA_PATH', [
    path.join(__dirname, '../data/mercari_processed.json'),
    path.join(process.cwd(), 'backend/data/mercari_processed.json'),
    path.join(process.cwd(), 'data/mercari_processed.json')
], true);
const DEPLOY_SAMPLE_DATA_PATH = resolveDataPath('MERCARI_DEPLOY_SAMPLE_PATH', [
    path.join(__dirname, '../data/mercari_deploy_sample.json'),
    path.join(process.cwd(), 'backend/data/mercari_deploy_sample.json'),
    path.join(process.cwd(), 'data/mercari_deploy_sample.json')
], true);

// USD to PHP conversion rate (approximate)
const USD_TO_PHP = Number(process.env.MERCARI_USD_TO_PHP || 56.0);

function resolveDataPath(envName, candidates, allowMissing = false) {
    const envPath = process.env[envName];
    if (envPath) return path.resolve(envPath);

    const existing = candidates.find(candidate => fs.existsSync(candidate));
    if (existing) return existing;

    return allowMissing ? candidates[0] : candidates[0];
}

/**
 * Load and process Mercari dataset
 * The dataset is in TSV format with columns:
 * - train_id, name, item_condition_id, category_name, brand_name, price, shipping, item_description
 */
export async function loadMercariData() {
    // Check if processed data exists
    if (fs.existsSync(PROCESSED_DATA_PATH)) {
        console.log('📦 Loading cached Mercari dataset...');

        try {
            // For very large files, use streaming JSON parser
            const JSONStream = (await import('JSONStream')).default;

            return new Promise((resolve, reject) => {
                const products = [];
                const stream = fs.createReadStream(PROCESSED_DATA_PATH, { encoding: 'utf8' });
                const parser = JSONStream.parse('*');

                stream.pipe(parser);

                parser.on('data', (product) => {
                    products.push(product);
                    if (products.length % 100000 === 0) {
                        console.log(`   Loaded ${products.length.toLocaleString()} products...`);
                    }
                });

                parser.on('end', () => {
                    console.log(`✅ Loaded ${products.length.toLocaleString()} products from cache`);
                    resolve(products);
                });

                parser.on('error', (err) => {
                    console.error('⚠️ Error reading cache, will reprocess:', err.message);
                    // Fall through to reprocess the TSV
                    reject(err);
                });
            }).catch(() => {
                // If streaming fails, delete cache and reprocess
                fs.unlinkSync(PROCESSED_DATA_PATH);
                return processRawData();
            });
        } catch (error) {
            console.log('⚠️ Could not use streaming parser, trying alternative method...');
            // Fallback: skip cache and reprocess
            fs.unlinkSync(PROCESSED_DATA_PATH);
            return processRawData();
        }
    }

    if (fs.existsSync(DEPLOY_SAMPLE_DATA_PATH)) {
        console.log('Loading deploy Mercari sample dataset...');
        return loadJsonArray(DEPLOY_SAMPLE_DATA_PATH);
    }

    return processRawData();
}

async function loadJsonArray(filePath) {
    const JSONStream = (await import('JSONStream')).default;

    return new Promise((resolve, reject) => {
        const products = [];
        const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
        const parser = JSONStream.parse('*');

        stream.pipe(parser);

        parser.on('data', (product) => {
            products.push(product);
            if (products.length % 100000 === 0) {
                console.log(`   Loaded ${products.length.toLocaleString()} products...`);
            }
        });

        parser.on('end', () => {
            console.log(`Loaded ${products.length.toLocaleString()} products from ${path.basename(filePath)}`);
            resolve(products);
        });

        parser.on('error', reject);
        stream.on('error', reject);
    });
}

function processRawData() {

    // Check if raw data exists
    if (!fs.existsSync(DATA_PATH)) {
        console.error('❌ Mercari dataset not found. Checked primary path:', DATA_PATH);
        console.error('Set MERCARI_DATASET_PATH to the deployed train.tsv path, or include backend/data/train.tsv in the backend deploy.');
        console.log('Please download it from: https://www.kaggle.com/competitions/mercari-price-suggestion-challenge/data');
        console.log('Or run: kaggle competitions download -c mercari-price-suggestion-challenge');
        return null;
    }

    console.log('🔄 Processing Mercari dataset (this may take a moment)...');

    return new Promise((resolve, reject) => {
        const products = [];

        createReadStream(DATA_PATH)
            .pipe(csv({ separator: '\t' }))
            .on('data', (row) => {
                try {
                    const product = parseMercariRow(row);

                    // Only include products with valid prices
                    if (product) {
                        products.push(product);
                    }
                } catch (error) {
                    // Skip invalid rows
                }
            })
            .on('end', () => {
                console.log(`✅ Processed ${products.length} valid products`);

                // Save processed data for faster loading next time
                // Write in chunks to avoid memory issues with large datasets
                try {
                    const writeStream = fs.createWriteStream(PROCESSED_DATA_PATH);
                    writeStream.write('[');

                    for (let i = 0; i < products.length; i++) {
                        writeStream.write(JSON.stringify(products[i]));
                        if (i < products.length - 1) {
                            writeStream.write(',');
                        }

                        // Free memory periodically
                        if (i % 10000 === 0 && i > 0) {
                            console.log(`💾 Writing cache... ${Math.round(i / products.length * 100)}%`);
                        }
                    }

                    writeStream.write(']');
                    writeStream.end();

                    writeStream.on('finish', () => {
                        console.log('💾 Cached processed data');
                        resolve(products);
                    });

                    writeStream.on('error', (err) => {
                        console.error('⚠️ Could not cache data:', err.message);
                        // Still resolve with products even if caching fails
                        resolve(products);
                    });
                } catch (err) {
                    console.error('⚠️ Could not cache data:', err.message);
                    // Still resolve with products even if caching fails
                    resolve(products);
                }
            })
            .on('error', (error) => {
                console.error('❌ Error processing Mercari dataset:', error);
                reject(error);
            });
    });
}

/**
 * Map Mercari condition ID to readable condition
 * 1 = Brand New, 2 = Like New, 3 = Lightly Used, 4 = Used, 5 = Heavily Used
 */
function mapCondition(conditionId) {
    const conditionMap = {
        1: 'Brand New',
        2: 'Like New',
        3: 'Lightly Used',
        4: 'Used',
        5: 'Heavily Used'
    };
    return conditionMap[conditionId] || 'Used';
}

/**
 * Parse hierarchical category name
 * Example: "Electronics/Computers & Tablets/Laptops & Netbooks"
 */
function parseCategoryName(categoryName) {
    if (!categoryName) return 'Other';

    const parts = categoryName.split('/');
    const mainCategory = parts[0] || 'Other';

    // Map to our categories
    const categoryMapping = {
        'Electronics': 'Electronics',
        'Men': 'Fashion',
        'Women': 'Fashion',
        'Beauty': 'Fashion',
        'Kids': 'Fashion',
        'Home': 'Home & Garden',
        'Sports & Outdoors': 'Sports',
        'Handmade': 'Collectibles',
        'Vintage & Collectibles': 'Collectibles'
    };

    return categoryMapping[mainCategory] || mainCategory;
}

/**
 * Get market statistics for a specific category
 */
export function getMercariMarketStats(products, category, brand = null) {
    let filtered = products.filter(p => p.category === category);

    if (brand) {
        filtered = filtered.filter(p =>
            p.brand.toLowerCase() === brand.toLowerCase()
        );
    }

    if (filtered.length === 0) {
        return null;
    }

    const prices = filtered.map(p => p.price).sort((a, b) => a - b);
    const trimmedPrices = trimOutliers(prices);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const trimmedAvgPrice = trimmedPrices.reduce((sum, p) => sum + p, 0) / trimmedPrices.length;
    const medianPrice = prices[Math.floor(prices.length / 2)];
    const minPrice = prices[0];
    const maxPrice = prices[prices.length - 1];

    // Get top brands in this category
    const brandCounts = {};
    filtered.forEach(p => {
        if (p.brand !== 'Unknown') {
            brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
        }
    });
    const topBrands = Object.entries(brandCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([brand]) => brand);

    // Condition-based pricing
    const conditionPrices = {};
    ['Brand New', 'Like New', 'Lightly Used', 'Used', 'Heavily Used', 'For Parts'].forEach(condition => {
        const conditionItems = filtered.filter(p => p.condition === condition);
        if (conditionItems.length > 0) {
            conditionPrices[condition] = {
                avg: conditionItems.reduce((sum, p) => sum + p.price, 0) / conditionItems.length,
                count: conditionItems.length
            };
        }
    });

    return {
        category,
        brand,
        totalItems: filtered.length,
        avgPrice: Math.round(avgPrice),
        trimmedAvgPrice: Math.round(trimmedAvgPrice),
        medianPrice: Math.round(medianPrice),
        priceRange: { min: minPrice, max: maxPrice },
        topBrands,
        conditionPrices,
        // Depreciation rates (relative to "New" condition)
        depreciation: calculateDepreciation(conditionPrices)
    };
}

// PH market correction: Mercari is 2018 US data; PH prices differ structurally by category.
// Electronics carry import premiums (~30% above US); fashion/beauty are cheaper in PH.
const PH_MARKET_CORRECTION = {
    Electronics: 1.30,
    Men: 0.85,
    Women: 0.85,
    Beauty: 0.90,
    Kids: 0.90,
    Home: 1.00,
    'Sports & Outdoors': 1.00,
    Handmade: 1.00,
};

function parseMercariRow(row) {
    const priceUSD = parseFloat(row.price);
    const topCategory = row.category_name ? row.category_name.split('/')[0] : '';
    const marketCorrection = PH_MARKET_CORRECTION[topCategory] ?? 1.00;
    const price = Math.round(priceUSD * USD_TO_PHP * marketCorrection);
    if (!Number.isFinite(price) || price <= 0 || price >= 1000000) return null;

    return {
        id: row.train_id,
        name: row.name || '',
        condition: mapCondition(parseInt(row.item_condition_id)),
        category: parseCategoryName(row.category_name),
        brand: row.brand_name || 'Unknown',
        price,
        priceUSD,
        shipping: parseInt(row.shipping) === 1,
        description: row.item_description || '',
        conditionId: parseInt(row.item_condition_id),
        categoryHierarchy: row.category_name ? row.category_name.split('/') : [],
        hasDescription: !!row.item_description && row.item_description.length > 10
    };
}

export async function streamMercariProducts(onProduct, options = {}) {
    const { limit = Infinity } = options;

    if (!fs.existsSync(DATA_PATH)) {
        throw new Error(`Mercari raw dataset not found at ${DATA_PATH}`);
    }

    return new Promise((resolve, reject) => {
        let validCount = 0;
        let totalRows = 0;
        let stopped = false;

        const stream = createReadStream(DATA_PATH)
            .pipe(csv({ separator: '\t' }))
            .on('data', (row) => {
                if (stopped) return;
                totalRows += 1;

                try {
                    const product = parseMercariRow(row);
                    if (!product) return;

                    onProduct(product);
                    validCount += 1;

                    if (validCount % 100000 === 0) {
                        console.log(`   Streamed ${validCount.toLocaleString()} valid Mercari products...`);
                    }

                    if (validCount >= limit) {
                        stopped = true;
                        stream.destroy();
                    }
                } catch {
                    // Skip invalid rows.
                }
            })
            .on('close', () => resolve({ totalRows, validCount }))
            .on('end', () => resolve({ totalRows, validCount }))
            .on('error', reject);
    });
}

function trimOutliers(sortedPrices) {
    if (sortedPrices.length < 20) return sortedPrices;
    const start = Math.floor(sortedPrices.length * 0.10);
    const end = Math.ceil(sortedPrices.length * 0.90);
    return sortedPrices.slice(start, end);
}

/**
 * Calculate depreciation rates relative to "New" condition
 */
function calculateDepreciation(conditionPrices) {
    const newPrice = conditionPrices['Brand New']?.avg;
    if (!newPrice) {
        return {
            'Brand New': 1.0,
            'Like New': 0.85,
            'Lightly Used': 0.70,
            'Used': 0.55,
            'Heavily Used': 0.35,
            'For Parts': 0.15
        };
    }

    const depreciation = {};
    Object.entries(conditionPrices).forEach(([condition, data]) => {
        depreciation[condition] = data.avg / newPrice;
    });

    return depreciation;
}

/**
 * Find comparable items from Mercari dataset
 */
export function findMercariComparables(products, productInfo, limit = 10) {
    const { category, brand, condition, keywords = [], model, specs = {} } = productInfo;
    const modelToken = model?.toLowerCase();
    const screenSize = Number(specs.screenSize);
    const isTv = keywords.some(k => ['tv', 'television', 'smart tv', 'oled', 'qled', '4k', '8k'].includes(k));

    // Score and filter products
    const scored = products.map(product => {
        let score = 0;

        // Category match (most important)
        if (product.category === category) score += 35;

        // Brand match
        if (brand && product.brand.toLowerCase() === brand.toLowerCase()) {
            score += 25;
        }

        // Condition match
        if (product.condition === condition) score += 15;

        // Keyword matches in name or description
        const text = (product.name + ' ' + product.description).toLowerCase();
        const hierarchy = (product.categoryHierarchy || []).join(' ').toLowerCase();
        const tvMarker = /\b(tv|television|oled|qled|uhd|4k|8k)\b/.test(text);
        const tvAccessoryMarker = /\b(earbud|earphone|headphone|speaker|blu[-\s]?ray|dvd|player|hdmi|cable|remote|charger|case|fire stick|streaming stick|adapter)\b/.test(text);
        if (modelToken && text.includes(modelToken)) score += 40;
        if (specs.resolution && new RegExp(`\\b${specs.resolution.toLowerCase()}\\b`).test(text)) score += 12;
        if (isTv && tvMarker) score += 35;
        if (isTv && !tvMarker) score -= 80;
        if (isTv && tvAccessoryMarker) score -= 90;
        if (screenSize) {
            const sizeMatch = text.match(/(\d{2,3}(?:\.\d+)?)\s*(?:inch|"|in\b)/i);
            if (sizeMatch) {
                const itemSize = Number(sizeMatch[1]);
                const diff = Math.abs(itemSize - screenSize);
                if (diff <= 2) score += 28;
                else if (diff <= 8) score += 12;
                else score -= 8;
            } else if (isTv) {
                score -= 25;
            }
        }
        keywords.forEach(keyword => {
            const clean = keyword.toString().toLowerCase();
            if (clean.length >= 3 && new RegExp(`\\b${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
                score += clean === modelToken ? 25 : 5;
            }
        });

        return { product, score };
    });

    // Sort by score and return top matches
    const minScore = isTv ? 55 : 30;
    return scored
        .filter(item => item.score > minScore) // Minimum relevance threshold
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => ({
            name: item.product.name,
            price: item.product.price,
            condition: item.product.condition,
            brand: item.product.brand,
            relevance: Math.min(100, Math.max(0, item.score)),
            demand: item.score >= 90 ? 'High' : item.score >= 60 ? 'Medium' : 'Low'
        }));
}

// ─── Market Index (production / no full dataset) ─────────────────────────────

const INDEX_CANDIDATES = [
    path.join(__dirname, '../data/models/mercari_market_index.json'),
    path.join(process.cwd(), 'backend/data/models/mercari_market_index.json'),
    path.join(process.cwd(), 'data/models/mercari_market_index.json'),
];

let _marketIndex = null;

export function loadMercariIndex() {
    if (_marketIndex) return _marketIndex;
    const indexPath = process.env.MERCARI_INDEX_PATH
        || INDEX_CANDIDATES.find(p => fs.existsSync(p));
    if (!indexPath) return null;
    try {
        _marketIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        console.log(`✅ Mercari market index loaded (${Object.keys(_marketIndex.categoryStats || {}).length} categories, built ${_marketIndex.builtAt})`);
        return _marketIndex;
    } catch (err) {
        console.warn('⚠️ Could not load Mercari market index:', err.message);
        return null;
    }
}

/**
 * getMercariMarketStats using precomputed index (used in production).
 * Falls back to scanning live products array if index unavailable.
 */
export function getMercariMarketStatsFromIndex(category, brand = null) {
    const index = loadMercariIndex();
    if (!index) return null;

    if (brand) {
        const key = `${category}::${brand}`;
        const brandStat = index.brandLevelStats?.[key];
        if (brandStat) return { ...brandStat, topBrands: index.categoryStats?.[category]?.topBrands || [] };
    }

    const catStat = index.categoryStats?.[category];
    return catStat || null;
}

/**
 * findMercariComparables using precomputed index samples (used in production).
 * Falls back to scanning live products array if index unavailable.
 */
export function findMercariComparablesFromIndex(productInfo, limit = 10) {
    const index = loadMercariIndex();
    if (!index) return [];

    const { category, brand, condition, keywords = [], model, specs = {} } = productInfo;
    const products = index.samples?.[category] || [];
    if (!products.length) return [];

    const modelToken = model?.toLowerCase();
    const screenSize = Number(specs.screenSize || 0);
    const isTv = keywords.some(k => ['tv', 'television', 'smart tv', 'oled', 'qled', '4k', '8k'].includes(k));

    const scored = products.map(product => {
        let score = 0;
        const text = (product.name + ' ' + (product.description || '')).toLowerCase();

        if (product.category === category) score += 35;
        if (brand && product.brand?.toLowerCase() === brand.toLowerCase()) score += 25;
        if (product.condition === condition) score += 15;
        if (modelToken && text.includes(modelToken)) score += 40;

        const tvMarker = /\b(tv|television|oled|qled|uhd|4k|8k)\b/.test(text);
        const tvAccessory = /\b(earbud|earphone|hdmi|cable|remote|charger|case|streaming|adapter)\b/.test(text);
        if (isTv && tvMarker) score += 35;
        if (isTv && !tvMarker) score -= 80;
        if (isTv && tvAccessory) score -= 90;

        if (screenSize) {
            const sizeMatch = text.match(/(\d{2,3}(?:\.\d+)?)\s*(?:inch|"|in\b)/i);
            if (sizeMatch) {
                const diff = Math.abs(Number(sizeMatch[1]) - screenSize);
                score += diff <= 2 ? 28 : diff <= 8 ? 12 : -8;
            } else if (isTv) score -= 25;
        }

        if (specs.resolution) {
            const res = specs.resolution.toLowerCase();
            if (text.includes(res)) score += 12;
        }

        keywords.forEach(kw => {
            const k = kw.toString().toLowerCase();
            if (k.length >= 3 && text.includes(k)) score += k === modelToken ? 25 : 5;
        });

        return { product, score };
    });

    const minScore = isTv ? 55 : 30;
    return scored
        .filter(i => i.score > minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(i => ({
            name: i.product.name,
            price: i.product.price,
            condition: i.product.condition,
            brand: i.product.brand,
            relevance: Math.min(100, Math.max(0, i.score)),
            demand: i.score >= 90 ? 'High' : i.score >= 60 ? 'Medium' : 'Low',
        }));
}

/**
 * Prepare training data from Mercari dataset for ML model
 */
export function prepareMercariTrainingData(products, maxSamples = 50000) {
    // Sample products for training (to avoid memory issues)
    const sampled = products.length > maxSamples
        ? products.sort(() => Math.random() - 0.5).slice(0, maxSamples)
        : products;

    return sampled.map(product => ({
        // Product info for feature extraction
        category: product.category,
        condition: product.condition,
        brand: product.brand,
        specs: {
            hasDescription: product.hasDescription,
            shipping: product.shipping
        },
        // Target price
        finalPrice: product.price
    }));
}

export default {
    loadMercariData,
    getMercariMarketStats,
    findMercariComparables,
    prepareMercariTrainingData,
    streamMercariProducts
};
