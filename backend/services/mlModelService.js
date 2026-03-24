import { RandomForestRegression } from 'ml-random-forest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadMercariData, prepareMercariTrainingData } from './mercariDataLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_PATH = path.join(__dirname, '../data/models/price_rf_model.json');

// Feature Encoding Maps (expanded for Mercari dataset)
const CATEGORY_MAP = {
    'Electronics': 1,
    'Fashion': 2,
    'Home & Garden': 3,
    'Sports': 4,
    'Collectibles': 5,
    'Smartphones': 6,
    'Laptops': 7,
    'Smartwatches': 8,
    'Tablets': 9,
    'Audio': 10,
    'Cameras': 11,
    'Gaming': 12,
    'Other': 0
};

const CONDITION_MAP = {
    'New': 5,
    'Like New': 4,
    'Good': 3,
    'Fair': 2,
    'Poor': 1
};

// Common brand encoding (top brands from Mercari dataset)
const BRAND_MAP = {
    'apple': 1,
    'samsung': 2,
    'nike': 3,
    'pink': 4,
    'victoria\'s secret': 5,
    'lularoe': 6,
    'lululemon': 7,
    'michael kors': 8,
    'louis vuitton': 9,
    'coach': 10
};

let rfModel = null;
let mercariDataCache = null;

/**
 * Initialize and load existing model if available
 */
export function initModel() {
    try {
        if (fs.existsSync(MODEL_PATH)) {
            const modelData = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
            rfModel = RandomForestRegression.load(modelData);
            console.log('✅ Random Forest model loaded from disk');
        }
    } catch (error) {
        console.error('❌ Error loading Random Forest model:', error);
    }
}

/**
 * Encode product info into numerical features
 */
function encodeFeatures(productInfo) {
    const categoryId = CATEGORY_MAP[productInfo.category] || 0;
    const conditionScore = CONDITION_MAP[productInfo.condition] || 3;

    // Brand encoding
    const brandLower = productInfo.brand?.toLowerCase() || '';
    const brandId = BRAND_MAP[brandLower] || 0;

    // Boolean features
    const hasDescription = productInfo.specs?.hasDescription ? 1 : 0;
    const hasShipping = productInfo.specs?.shipping ? 1 : 0;

    // Extract storage as number if possible
    let storageVal = 0;
    if (productInfo.specs?.storage) {
        const match = productInfo.specs.storage.match(/\d+/);
        if (match) storageVal = parseInt(match[0]);
    }

    // Feature Vector: [category_id, condition_score, brand_id, has_description, has_shipping, storage_gb]
    return [categoryId, conditionScore, brandId, hasDescription, hasShipping, storageVal];
}

/**
 * Train model with historical data
 */
export async function trainModel(trainingData) {
    if (!trainingData || trainingData.length < 5) {
        console.log('⚠️ Insufficient data for Random Forest training (minimum 5 records)');
        return false;
    }

    const X = trainingData.map(item => encodeFeatures(item));
    const y = trainingData.map(item => item.finalPrice);

    const options = {
        seed: 42,
        maxFeatures: 3,
        replacement: true,
        nEstimators: 25  // Reduced for faster training with large dataset
    };

    rfModel = new RandomForestRegression(options);
    rfModel.train(X, y);

    // Save model
    const modelDir = path.dirname(MODEL_PATH);
    if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
    }

    fs.writeFileSync(MODEL_PATH, JSON.stringify(rfModel.toJSON()));
    console.log(`🚀 Random Forest trained with ${trainingData.length} samples and saved.`);
    return true;
}

/**
 * Train model with Mercari dataset
 */
export async function trainWithMercariData(maxSamples = 50000) {
    try {
        console.log('📦 Loading Mercari dataset...');

        // Load Mercari data
        if (!mercariDataCache) {
            mercariDataCache = await loadMercariData();
        }

        if (!mercariDataCache) {
            console.error('❌ Failed to load Mercari dataset');
            return false;
        }

        console.log(`📊 Preparing training data from ${mercariDataCache.length} products...`);

        // Prepare training data
        const trainingData = prepareMercariTrainingData(mercariDataCache, maxSamples);

        console.log(`🎯 Training model with ${trainingData.length} samples...`);

        // Train the model
        return await trainModel(trainingData);
    } catch (error) {
        console.error('❌ Error training with Mercari data:', error);
        return false;
    }
}

/**
 * Get cached Mercari data
 */
export function getMercariData() {
    return mercariDataCache;
}

/**
 * Load Mercari data into cache
 */
export async function loadMercariDataCache() {
    if (!mercariDataCache) {
        mercariDataCache = await loadMercariData();
    }
    return mercariDataCache;
}

/**
 * Predict price for a product
 */
export function predictPrice(productInfo) {
    if (!rfModel) {
        console.log('⚠️ Random Forest model not loaded. Using fallback logic.');
        return null;
    }

    const features = encodeFeatures(productInfo);
    const prediction = rfModel.predict([features])[0];
    
    return Math.round(prediction);
}
