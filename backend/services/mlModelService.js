import fs from 'fs';
import path from 'path';
import { RandomForestRegression } from 'ml-random-forest';
import { loadMercariData } from './mercariDataLoader.js';

const MODEL_PATH = path.join(process.cwd(), 'data', 'models', 'price_rf_model.json');

let rfModel = null;
let mercariDataCache = null;

// Ensure models directory exists
const modelsDir = path.dirname(MODEL_PATH);
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

/**
 * Initialize model by loading from disk if available
 */
export function initModel() {
    try {
        if (fs.existsSync(MODEL_PATH)) {
            const modelData = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
            rfModel = RandomForestRegression.load(modelData);
            console.log('✅ Random Forest model loaded from disk');
        } else {
            console.log('ℹ️ Random Forest model not found on disk. Training recommended.');
        }
    } catch (error) {
        console.error('❌ Error loading Random Forest model:', error);
    }
}

/**
 * Train model using Mercari dataset
 */
export async function trainWithMercariData(samples = 10000) {
    try {
        const products = await loadMercariData();
        if (!products || products.length === 0) {
            throw new Error('No products found in Mercari dataset');
        }

        console.log(`📊 Preparing training data from ${products.length} products...`);
        
        // Take a random sample for training to keep it efficient
        const trainingSamples = products
            .sort(() => 0.5 - Math.random())
            .slice(0, samples);

        const X = trainingSamples.map(p => encodeFeatures(p));
        const y = trainingSamples.map(p => p.price);

        console.log(`🎯 Training model with ${samples} samples...`);
        rfModel = new RandomForestRegression({
            nEstimators: 100,
            maxDepth: 10,
            seed: 42
        });

        rfModel.train(X, y);

        // Save model to disk
        fs.writeFileSync(MODEL_PATH, JSON.stringify(rfModel.toJSON()));
        console.log('✅ Model trained and saved to', MODEL_PATH);
        
        return true;
    } catch (error) {
        console.error('❌ Error training model:', error);
        return false;
    }
}

/**
 * Encode product features for ML model
 */
function encodeFeatures(product) {
    // Condition mapping (1-6 scale)
    const CONDITION_MAP = {
        'Brand New': 6,
        'Like New': 5,
        'Lightly Used': 4,
        'Used': 3,
        'Heavily Used': 2,
        'For Parts': 1,
        'new': 6,
        'like_new': 5,
        'good': 4,
        'fair': 3,
        'poor': 2,
        'parts': 1
    };

    // Category mapping (simple label encoding)
    const CATEGORIES = [
        'Electronics', 'Fashion', 'Home & Garden', 'Sports', 'Collectibles', 'Other'
    ];

    const categoryIdx = CATEGORIES.indexOf(product.category) || 5;
    const conditionScore = CONDITION_MAP[product.condition] || 3;

    // Return feature vector
    return [
        categoryIdx,
        conditionScore,
        product.brand ? 1 : 0,
        (product.name?.length || 0) / 100,
        (product.description?.length || 0) / 500
    ];
}

/**
 * Predict price for a product
 */
export function predictPrice(productInfo) {
    if (!rfModel) {
        // Try to load on-the-fly if not loaded yet
        initModel();
    }

    if (!rfModel) {
        console.log('⚠️ Random Forest model not available. Falling back to market data average.');
        return null;
    }

    const features = encodeFeatures(productInfo);
    const prediction = rfModel.predict([features])[0];
    
    return Math.round(prediction);
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
