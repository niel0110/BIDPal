import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RandomForestRegression } from 'ml-random-forest';
import { loadMercariData, streamMercariProducts } from './mercariDataLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_PATH = resolveModelPath();
const MODEL_FEATURE_VERSION = 3;

let rfModel = null;
let rfFeatureVersion = 1;
let rfModelMetadata = null;
let mercariDataCache = null;

const modelsDir = path.dirname(MODEL_PATH);
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

function resolveModelPath() {
    const envPath = process.env.PRICE_RF_MODEL_PATH;
    if (envPath) return path.resolve(envPath);

    const candidates = [
        path.join(__dirname, '../data/models/price_rf_model.json'),
        path.join(process.cwd(), 'backend/data/models/price_rf_model.json'),
        path.join(process.cwd(), 'data/models/price_rf_model.json')
    ];

    return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
}

export function initModel() {
    try {
        if (!fs.existsSync(MODEL_PATH)) {
            console.log('Random Forest model not found on disk. Training recommended.');
            return;
        }

        const persisted = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
        const modelData = persisted.model || persisted;
        rfModel = RandomForestRegression.load(modelData);
        rfModelMetadata = persisted.metadata || null;
        rfFeatureVersion = persisted.metadata?.featureVersion || inferFeatureVersion(modelData);
        console.log(`Random Forest model loaded from disk (feature v${rfFeatureVersion})`);
    } catch (error) {
        console.error('Error loading Random Forest model:', error);
    }
}

export async function trainWithMercariData(samples = 10000) {
    try {
        const fullRun = samples === 'full' || samples === 'all' || samples === Infinity || Number(samples) <= 0;
        const X = [];
        const y = [];
        let scannedRows = 0;
        let validRows = 0;

        if (fullRun) {
            console.log('Streaming full Mercari dataset for Random Forest training...');
            const stats = await streamMercariProducts((product) => {
                X.push(encodeFeatures(product, MODEL_FEATURE_VERSION));
                y.push(product.price);
            });
            scannedRows = stats.totalRows;
            validRows = stats.validCount;
        } else {
            const products = await loadMercariData();
            if (!products || products.length === 0) {
                throw new Error('No products found in Mercari dataset');
            }

            console.log(`Preparing training data from ${products.length.toLocaleString()} loaded products...`);
            const trainingSamples = sampleProducts(products, Number(samples));
            trainingSamples.forEach(product => {
                X.push(encodeFeatures(product, MODEL_FEATURE_VERSION));
                y.push(product.price);
            });
            scannedRows = products.length;
            validRows = trainingSamples.length;
        }

        if (X.length === 0) {
            throw new Error('No valid training rows found in Mercari dataset');
        }

        const nEstimators = Number(process.env.PRICE_RF_TREES || 150);
        const maxDepth = Number(process.env.PRICE_RF_MAX_DEPTH || 16);

        console.log(`Training Random Forest with ${X.length.toLocaleString()} Mercari samples...`);
        console.log(`Trees: ${nEstimators}, max depth: ${maxDepth}, feature version: ${MODEL_FEATURE_VERSION}`);

        rfModel = new RandomForestRegression({
            nEstimators,
            maxDepth,
            seed: 42
        });

        rfModel.train(X, y);
        rfFeatureVersion = MODEL_FEATURE_VERSION;
        rfModelMetadata = {
            source: 'Mercari Price Suggestion Challenge',
            trainedAt: new Date().toISOString(),
            trainedSamples: X.length,
            scannedRows,
            validRows,
            fullDataset: fullRun,
            featureVersion: MODEL_FEATURE_VERSION,
            nEstimators,
            maxDepth,
            targetCurrency: 'PHP',
            features: getFeatureNames(MODEL_FEATURE_VERSION)
        };

        fs.writeFileSync(MODEL_PATH, JSON.stringify({
            metadata: rfModelMetadata,
            model: rfModel.toJSON()
        }));

        console.log('Model trained and saved to', MODEL_PATH);
        console.log('Training metadata:', rfModelMetadata);
        return true;
    } catch (error) {
        console.error('Error training Random Forest model:', error);
        return false;
    }
}

function inferFeatureVersion(modelData) {
    const featureCount = modelData?.baseModel?.n;
    if (featureCount === 5) return 1;
    if (featureCount === 21) return 2;
    return MODEL_FEATURE_VERSION;
}

function sampleProducts(products, sampleSize) {
    if (!sampleSize || sampleSize >= products.length) return products;

    const sampled = [];
    for (let i = 0; i < products.length; i += 1) {
        if (i < sampleSize) {
            sampled.push(products[i]);
        } else {
            const j = Math.floor(Math.random() * (i + 1));
            if (j < sampleSize) sampled[j] = products[i];
        }
    }
    return sampled;
}

function encodeFeatures(product, featureVersion = MODEL_FEATURE_VERSION) {
    if (featureVersion === 1) return encodeFeaturesV1(product);
    if (featureVersion === 2) return encodeFeaturesV2(product);

    const conditionScore = getConditionScore(product.condition) / 6;
    const categoryIdx = getCategoryIndex(product.category);
    const text = getProductText(product);
    const brand = product.brand && product.brand !== 'Unknown' ? product.brand : '';
    const model = product.model || '';
    const screenSize = extractScreenSize(text);
    const year = extractYear(text);
    const age = year ? Math.max(0, new Date().getFullYear() - year) : 0;

    return [
        categoryIdx / 5,
        conditionScore,
        brand ? 1 : 0,
        stableHash(brand) / 1000,
        stableHash(model) / 1000,
        Math.min((product.name?.length || 0) / 100, 2),
        Math.min((product.description?.length || 0) / 800, 2),
        product.shipping ? 1 : 0,
        hasAny(text, ['electronics', 'cell phone', 'smartphone', 'laptop', 'computer', 'camera']) ? 1 : 0,
        hasAny(text, ['fashion', 'women', 'men', 'shoes', 'bag', 'handbag', 'jewelry']) ? 1 : 0,
        hasAny(text, ['home', 'furniture', 'decor', 'kitchen']) ? 1 : 0,
        hasAny(text, ['tv', 'television', 'smart tv', 'oled', 'qled', 'uhd']) ? 1 : 0,
        hasAny(text, ['phone', 'iphone', 'galaxy', 'smartphone']) ? 1 : 0,
        hasAny(text, ['laptop', 'macbook', 'notebook', 'computer']) ? 1 : 0,
        hasAny(text, ['pro', 'max', 'ultra', 'plus', 'air', 'series']) ? 1 : 0,
        hasAny(text, ['new', 'sealed', 'unopened', 'original box']) ? 1 : 0,
        hasAny(text, ['broken', 'crack', 'parts only', 'not working', 'fix']) ? 1 : 0,
        hasAny(text, ['oled', 'qled', '4k', 'uhd']) ? 1 : 0,
        screenSize ? Math.min(screenSize / 100, 1.5) : 0,
        age ? Math.min(age / 10, 2) : 0,
        isPremiumElectronicsBrand(brand) ? 1 : 0,
        isLuxuryBrand(brand) ? 1 : 0,
        isAccessory(text) ? 1 : 0,
        stableHash(product.categoryHierarchy?.[1] || '') / 1000,
        stableHash(product.categoryHierarchy?.[2] || '') / 1000
    ];
}

function encodeFeaturesV2(product) {
    const conditionScore = getConditionScore(product.condition) / 6;
    const categoryIdx = getCategoryIndex(product.category);
    const text = getProductText(product);
    const brand = product.brand && product.brand !== 'Unknown' ? product.brand : '';
    const screenSize = extractScreenSize(text);
    const year = extractYear(text);
    const age = year ? Math.max(0, new Date().getFullYear() - year) : 0;

    return [
        categoryIdx / 5,
        conditionScore,
        brand ? 1 : 0,
        stableHash(brand) / 1000,
        Math.min((product.name?.length || 0) / 100, 2),
        Math.min((product.description?.length || 0) / 800, 2),
        product.shipping ? 1 : 0,
        hasAny(text, ['electronics', 'cell phone', 'smartphone', 'laptop', 'computer', 'camera']) ? 1 : 0,
        hasAny(text, ['fashion', 'women', 'men', 'shoes', 'bag', 'handbag', 'jewelry']) ? 1 : 0,
        hasAny(text, ['home', 'furniture', 'decor', 'kitchen']) ? 1 : 0,
        hasAny(text, ['tv', 'television', 'smart tv', 'oled', 'qled', 'uhd']) ? 1 : 0,
        hasAny(text, ['phone', 'iphone', 'galaxy', 'smartphone']) ? 1 : 0,
        hasAny(text, ['laptop', 'macbook', 'notebook', 'computer']) ? 1 : 0,
        hasAny(text, ['oled']) ? 1 : 0,
        hasAny(text, ['qled']) ? 1 : 0,
        hasAny(text, ['4k', 'uhd']) ? 1 : 0,
        screenSize ? Math.min(screenSize / 100, 1.5) : 0,
        age ? Math.min(age / 10, 2) : 0,
        isPremiumElectronicsBrand(brand) ? 1 : 0,
        isLuxuryBrand(brand) ? 1 : 0,
        isAccessory(text) ? 1 : 0
    ];
}

function encodeFeaturesV1(product) {
    return [
        getCategoryIndex(product.category),
        getConditionScore(product.condition),
        product.brand ? 1 : 0,
        (product.name?.length || 0) / 100,
        (product.description?.length || 0) / 500
    ];
}

function getFeatureNames(featureVersion = MODEL_FEATURE_VERSION) {
    if (featureVersion === 1) {
        return ['categoryIndex', 'conditionScore', 'hasBrand', 'nameLength', 'descriptionLength'];
    }
    if (featureVersion === 2) {
        return [
            'categoryIndex', 'conditionScore', 'hasBrand', 'brandHash', 'nameLength',
            'descriptionLength', 'sellerPaysShipping', 'isElectronics', 'isFashion',
            'isHome', 'isTv', 'isPhone', 'isLaptop', 'hasOled', 'hasQled', 'has4k',
            'screenSize', 'age', 'premiumElectronicsBrand', 'luxuryBrand', 'isAccessory'
        ];
    }

    return [
        'categoryIndex', 'conditionScore', 'hasBrand', 'brandHash', 'modelHash', 'nameLength',
        'descriptionLength', 'sellerPaysShipping', 'isElectronics', 'isFashion',
        'isHome', 'isTv', 'isPhone', 'isLaptop', 'isPremiumTier', 'isNewCondition',
        'isBroken', 'hasAdvancedDisplay', 'screenSize', 'age', 'premiumElectronicsBrand',
        'luxuryBrand', 'isAccessory', 'subCategoryHash', 'leafCategoryHash'
    ];
}

function getConditionScore(condition) {
    const conditionMap = {
        'Brand New': 6,
        'Like New': 5,
        'Lightly Used': 4,
        'Used': 3,
        'Heavily Used': 2,
        'For Parts': 1,
        new: 6,
        like_new: 5,
        good: 4,
        fair: 3,
        poor: 2,
        parts: 1
    };
    return conditionMap[condition] || 3;
}

function getCategoryIndex(category) {
    const categories = ['Electronics', 'Fashion', 'Home & Garden', 'Sports', 'Collectibles', 'Other'];
    const rawCategoryIdx = categories.indexOf(category);
    return rawCategoryIdx === -1 ? 5 : rawCategoryIdx;
}

function getProductText(product) {
    return [
        product.name || '',
        product.description || '',
        product.brand || '',
        product.category || '',
        ...(product.categoryHierarchy || []),
        ...(product.keywords || [])
    ].join(' ').toLowerCase();
}

function hasAny(text, terms) {
    return terms.some(term => text.includes(term));
}

function stableHash(value) {
    if (!value) return 0;
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) % 1000;
    }
    return hash;
}

function extractScreenSize(text) {
    const match = text.match(/(\d{2,3}(?:\.\d+)?)\s*(?:inch|"|in\b)/i);
    return match ? Number(match[1]) : 0;
}

function extractYear(text) {
    const match = text.match(/\b(20\d{2})\b/);
    return match ? Number(match[1]) : 0;
}

function isPremiumElectronicsBrand(brand) {
    return ['Apple', 'Samsung', 'Sony', 'LG', 'Bose', 'Canon', 'Nikon', 'Dell', 'HP', 'Lenovo'].includes(brand);
}

function isLuxuryBrand(brand) {
    return ['Gucci', 'Louis Vuitton', 'Prada', 'Chanel', 'Hermes', 'Dior', 'Burberry', 'Rolex', 'Omega'].includes(brand);
}

function isAccessory(text) {
    return hasAny(text, [
        'case', 'cover', 'charger', 'cable', 'adapter', 'screen protector',
        'earbud', 'earphone', 'remote', 'mount', 'strap', 'box only'
    ]);
}

export function predictPrice(productInfo) {
    if (!rfModel) {
        initModel();
    }

    if (!rfModel) {
        console.log('Random Forest model not available. Falling back to market data average.');
        return null;
    }

    const features = encodeFeatures(productInfo, rfFeatureVersion);
    const prediction = rfModel.predict([features])[0];

    return Math.round(prediction);
}

export function getMercariData() {
    return mercariDataCache;
}

export function getModelMetadata() {
    return rfModelMetadata;
}

export async function loadMercariDataCache() {
    if (!mercariDataCache) {
        mercariDataCache = await loadMercariData();
        if (!Array.isArray(mercariDataCache) || mercariDataCache.length === 0) {
            mercariDataCache = null;
            throw new Error('Mercari dataset not available');
        }
    }
    return mercariDataCache;
}
