import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { createReadStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, '../data/train.tsv');
const PROCESSED_DATA_PATH = path.join(__dirname, '../data/mercari_processed.json');

// USD to PHP conversion rate (approximate)
const USD_TO_PHP = 56.0;

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

    return processRawData();
}

function processRawData() {

    // Check if raw data exists
    if (!fs.existsSync(DATA_PATH)) {
        console.error('❌ Mercari dataset not found at:', DATA_PATH);
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
                    // Parse and convert data
                    const product = {
                        id: row.train_id,
                        name: row.name,
                        condition: mapCondition(parseInt(row.item_condition_id)),
                        category: parseCategoryName(row.category_name),
                        brand: row.brand_name || 'Unknown',
                        price: Math.round(parseFloat(row.price) * USD_TO_PHP), // Convert USD to PHP
                        priceUSD: parseFloat(row.price),
                        shipping: parseInt(row.shipping) === 1, // true if seller pays shipping
                        description: row.item_description || '',
                        // Extracted features for ML
                        conditionId: parseInt(row.item_condition_id),
                        categoryHierarchy: row.category_name ? row.category_name.split('/') : [],
                        hasDescription: !!row.item_description && row.item_description.length > 10
                    };

                    // Only include products with valid prices
                    if (product.price > 0 && product.price < 1000000) {
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
 * 1 = New, 2 = Like New, 3 = Good, 4 = Fair, 5 = Poor
 */
function mapCondition(conditionId) {
    const conditionMap = {
        1: 'New',
        2: 'Like New',
        3: 'Good',
        4: 'Fair',
        5: 'Poor'
    };
    return conditionMap[conditionId] || 'Good';
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
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
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
    ['New', 'Like New', 'Good', 'Fair', 'Poor'].forEach(condition => {
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
        medianPrice: Math.round(medianPrice),
        priceRange: { min: minPrice, max: maxPrice },
        topBrands,
        conditionPrices,
        // Depreciation rates (relative to "New" condition)
        depreciation: calculateDepreciation(conditionPrices)
    };
}

/**
 * Calculate depreciation rates relative to "New" condition
 */
function calculateDepreciation(conditionPrices) {
    const newPrice = conditionPrices['New']?.avg;
    if (!newPrice) {
        // Fallback to default depreciation
        return {
            'New': 1.0,
            'Like New': 0.85,
            'Good': 0.70,
            'Fair': 0.50,
            'Poor': 0.30
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
    const { category, brand, condition, keywords } = productInfo;

    // Score and filter products
    const scored = products.map(product => {
        let score = 0;

        // Category match (most important)
        if (product.category === category) score += 50;

        // Brand match
        if (brand && product.brand.toLowerCase() === brand.toLowerCase()) {
            score += 30;
        }

        // Condition match
        if (product.condition === condition) score += 15;

        // Keyword matches in name or description
        const text = (product.name + ' ' + product.description).toLowerCase();
        keywords.forEach(keyword => {
            if (text.includes(keyword.toLowerCase())) {
                score += 5;
            }
        });

        return { product, score };
    });

    // Sort by score and return top matches
    return scored
        .filter(item => item.score > 30) // Minimum relevance threshold
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => ({
            name: item.product.name,
            price: item.product.price,
            condition: item.product.condition,
            brand: item.product.brand,
            relevance: item.score
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
    prepareMercariTrainingData
};
