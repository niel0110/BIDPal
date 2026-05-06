// Product analyzer utilities
// Note: This module no longer uses local marketDataset.json
// All market data comes from the Mercari dataset

/**
 * Extract detailed product information from name and description
 */
export function extractProductInfo(product) {
    const { name, description, brand, condition, category, specifications } = product;

    const combined = `${name} ${description} ${specifications || ''}`.toLowerCase();
    const specs = extractSpecs(combined, category);
    const model = extractModel(name || '');

    return {
        name: name || '',
        description: description || '',
        brand: brand || extractBrand(combined),
        model,
        specs,
        keywords: extractKeywords(combined, model, specs),
        condition: normalizeCondition(condition || 'Used'),
        category: normalizeCategory(category || detectCategory(combined))
    };
}

function normalizeCondition(condition) {
    const normalized = condition.toString().trim().toLowerCase();
    const mapping = {
        new: 'Brand New',
        brand_new: 'Brand New',
        'brand new': 'Brand New',
        like_new: 'Like New',
        'like new': 'Like New',
        good: 'Lightly Used',
        lightly_used: 'Lightly Used',
        'lightly used': 'Lightly Used',
        used: 'Used',
        fair: 'Used',
        poor: 'Heavily Used',
        heavily_used: 'Heavily Used',
        'heavily used': 'Heavily Used',
        parts: 'For Parts',
        for_parts: 'For Parts',
        'for parts': 'For Parts'
    };

    return mapping[normalized] || condition;
}

/**
 * Normalize category string to match Mercari dataset categories
 */
// Granular categories that map directly — checked before broad fallbacks
const GRANULAR_CATEGORY_MAP = {
    smartphone: 'Smartphones', mobile: 'Smartphones', cellphone: 'Smartphones',
    laptop: 'Laptops', notebook: 'Laptops', macbook: 'Laptops',
    television: 'TVs', ' tv': 'TVs', 'smart tv': 'TVs', oled: 'TVs', qled: 'TVs',
    refrigerator: 'Home & Garden', fridge: 'Home & Garden', freezer: 'Home & Garden',
    washer: 'Home & Garden', washing: 'Home & Garden', dryer: 'Home & Garden',
    appliance: 'Home & Garden',
    tablet: 'Tablets', ipad: 'Tablets',
    camera: 'Cameras', dslr: 'Cameras', mirrorless: 'Cameras',
    'gaming console': 'Gaming Consoles', playstation: 'Gaming Consoles',
    xbox: 'Gaming Consoles', nintendo: 'Gaming Consoles',
    headphone: 'Headphones', earphone: 'Headphones', airpods: 'Headphones',
    smartwatch: 'Smartwatches', 'apple watch': 'Smartwatches',
};

function normalizeCategory(category) {
    if (!category) return 'Other';

    const normalized = category.toLowerCase();

    // Preserve exact granular matches first (e.g. "Smartphones", "Laptops")
    const granularMatch = Object.keys(GRANULAR_CATEGORY_MAP)
        .find(k => normalized.includes(k));
    if (granularMatch) return GRANULAR_CATEGORY_MAP[granularMatch];

    if (category.includes(':')) {
        const main = category.split(':')[0].toLowerCase();
        const mapping = {
            electronics: 'Electronics', fashion: 'Fashion',
            home: 'Home & Garden', culture: 'Collectibles',
            sports: 'Sports', automotive: 'Other'
        };
        return mapping[main] || 'Other';
    }

    if (normalized.includes('electronic') || normalized.includes('computer') ||
        normalized.includes('gaming') || normalized.includes('audio'))
        return 'Electronics';

    if (normalized.includes('fashion') || normalized.includes('clothing') ||
        normalized.includes('shoe') || normalized.includes('bag') ||
        normalized.includes('watch') || normalized.includes('jewelry'))
        return 'Fashion';

    if (normalized.includes('home') || normalized.includes('kitchen') ||
        normalized.includes('furniture') || normalized.includes('garden'))
        return 'Home & Garden';

    if (normalized.includes('sport') || normalized.includes('outdoor') ||
        normalized.includes('bicycle'))
        return 'Sports';

    if (normalized.includes('collectible') || normalized.includes('vintage') ||
        normalized.includes('culture') || normalized.includes('instrument'))
        return 'Collectibles';

    return category;
}

/**
 * Extract brand from text using common brand patterns
 */
function extractBrand(text) {
    // Common brands across categories
    const commonBrands = [
        // Electronics
        'Apple', 'Samsung', 'Sony', 'LG', 'Huawei', 'Xiaomi', 'Oppo', 'Vivo', 'OnePlus', 'Google',
        'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Microsoft', 'Razer', 'TCL', 'Hisense',
        // Fashion
        'Nike', 'Adidas', 'Puma', 'Under Armour', 'Reebok', 'New Balance', 'Converse',
        'Gucci', 'Louis Vuitton', 'Prada', 'Chanel', 'Hermes', 'Dior', 'Burberry',
        'Zara', 'H&M', 'Uniqlo', 'Gap', 'Forever 21',
        // Watches
        'Rolex', 'Omega', 'Casio', 'Seiko', 'Citizen', 'Fossil', 'Timex',
        // Cameras
        'Canon', 'Nikon', 'Fujifilm', 'Panasonic', 'Olympus', 'GoPro',
        // Audio
        'Bose', 'JBL', 'Sennheiser', 'Audio-Technica', 'Beats', 'AKG', 'Shure',
        // Gaming
        'PlayStation', 'Xbox', 'Nintendo', 'Logitech', 'Corsair', 'SteelSeries'
    ];

    // Find brand mention in text
    for (const brand of commonBrands) {
        if (text.includes(brand.toLowerCase())) {
            return brand;
        }
    }

    return null;
}

/**
 * Extract model name
 */
function extractModel(name) {
    if (!name) return null;

    const exactModel = name.match(/\b([A-Z]{1,4}\d{2,5}[A-Z0-9-]*)\b/);
    if (exactModel) return exactModel[1];

    // Common model patterns
    const patterns = [
        /(\d+\s*(pro|max|ultra|plus|mini|air|lite))/gi,
        /(series\s*\d+)/gi,
        /(model\s*[\w-]+)/gi,
        /([A-Z]\d+[\w-]*)/g
    ];

    for (const pattern of patterns) {
        const match = name.match(pattern);
        if (match) return match[0];
    }

    return null;
}

/**
 * Extract technical specifications
 */
function extractSpecs(text) {
    const specs = {};

    // Storage
    const storageMatch = text.match(/(\d+)\s*(gb|tb)/i);
    if (storageMatch) {
        specs.storage = storageMatch[0].toUpperCase();
    }

    // RAM
    const ramMatch = text.match(/(\d+)\s*gb\s*ram/i);
    if (ramMatch) {
        specs.ram = ramMatch[1] + 'GB';
    }

    // Screen size
    const screenMatch = text.match(/(\d+\.?\d*)\s*(inch|"|′)/i);
    if (screenMatch) {
        specs.screenSize = parseFloat(screenMatch[1]);
    }

    // Appliance capacity
    const cuFtMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:cu\.?\s*ft|cubic\s*feet|ft3)\b/i);
    if (cuFtMatch) {
        specs.capacityCuFt = parseFloat(cuFtMatch[1]);
    }
    const literMatch = text.match(/(\d{2,4})\s*(?:l|liter|litre)s?\b/i);
    if (literMatch && /(refrigerator|fridge|freezer|washer|washing|dryer|appliance)/i.test(text)) {
        specs.capacityLiters = parseInt(literMatch[1], 10);
    }

    // Resolution
    if (text.includes('4k') || text.includes('2160p')) {
        specs.resolution = '4K';
    } else if (text.includes('1080p') || text.includes('full hd')) {
        specs.resolution = 'Full HD';
    } else if (text.includes('720p') || text.includes('hd')) {
        specs.resolution = 'HD';
    }

    // Color
    const colorPatterns = ['black', 'white', 'silver', 'gold', 'blue', 'red', 'green', 'pink', 'gray', 'space gray', 'midnight'];
    for (const color of colorPatterns) {
        if (text.includes(color)) {
            specs.color = color.charAt(0).toUpperCase() + color.slice(1);
            break;
        }
    }

    // Age — try explicit year first, then plain-English ("2 years old", "bought last year")
    const yearMatch = text.match(/(20\d{2})/);
    if (yearMatch) {
        specs.year = parseInt(yearMatch[1]);
        specs.age = new Date().getFullYear() - specs.year;
    } else {
        const ageMatch = text.match(/(\d+)\s*(?:year|yr)s?(?:\s+and\s+\d+\s+months?)?\s*(?:old|used)?/i);
        if (ageMatch) {
            specs.age = parseInt(ageMatch[1]);
        } else if (/bought\s+last\s+year|purchased\s+last\s+year/i.test(text)) {
            specs.age = 1;
        } else if (/brand\s*new\s+this\s+year|bought\s+this\s+year/i.test(text)) {
            specs.age = 0;
        }
    }

    return specs;
}

/**
 * Extract relevant keywords
 */
function extractKeywords(text, model, specs = {}) {
    const keywords = [];

    const importantKeywords = [
        'unlocked', 'factory', 'sealed', 'warranty', 'box', 'accessories',
        'charger', 'case', 'screen protector', 'original', 'authentic',
        'limited edition', 'rare', 'vintage', 'collectible', 'mint',
        'water resistant', 'wireless', 'bluetooth', 'wifi', '5g', 'lte',
        'gaming', 'professional', 'business', 'student', 'portable',
        'tv', 'television', 'smart tv', 'oled', 'qled', 'led', '4k', '8k',
        'uhd', 'hdr', 'dolby vision', 'soundbar', 'refrigerator', 'fridge',
        'freezer', 'instaview', 'door-in-door', 'inverter', 'linear compressor',
        'frost-free', 'smart diagnosis', 'stainless steel'
    ];

    for (const keyword of importantKeywords) {
        if (text.includes(keyword)) {
            keywords.push(keyword);
        }
    }

    if (model) keywords.push(model.toLowerCase());
    if (specs.resolution) keywords.push(specs.resolution.toLowerCase());
    if (specs.screenSize) {
        keywords.push(`${specs.screenSize}`);
        keywords.push(`${specs.screenSize} inch`);
    }

    return keywords;
}

/**
 * Detect category from text
 */
function detectCategory(text) {
    const categoryKeywords = {
        'Smartphones': ['phone', 'iphone', 'android', 'smartphone', 'mobile'],
        'Laptops': ['laptop', 'notebook', 'macbook', 'chromebook'],
        'Smartwatches': ['watch', 'smartwatch', 'apple watch', 'galaxy watch'],
        'Tablets': ['tablet', 'ipad', 'tab'],
        'Headphones': ['headphone', 'earphone', 'airpods', 'earbuds', 'headset'],
        'TVs': ['tv', 'television', 'smart tv', 'led', 'oled'],
        'Cameras': ['camera', 'dslr', 'mirrorless', 'camcorder'],
        'Gaming Consoles': ['playstation', 'xbox', 'nintendo', 'ps5', 'switch', 'console'],
        'Bicycles': ['bike', 'bicycle', 'mtb', 'mountain bike', 'road bike']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                return category;
            }
        }
    }

    return 'General';
}


// ─── PH Secondhand Price Formula ─────────────────────────────────────────────
// Price = PH_SRP × condition × age × brand × demand × spec

const CONDITION_FACTORS = {
    'Brand New':    0.90,
    'Like New':     0.75,
    'Lightly Used': 0.60,
    'Used':         0.45,
    'Heavily Used': 0.28,
    'For Parts':    0.10,
};

const BRAND_PREMIUMS = {
    'Apple':        { default: 1.20 },
    'Sony':         { default: 1.15, 'Electronics': 1.20 },
    'LG':           { default: 1.10, 'Electronics': 1.15 },
    'Samsung':      { default: 1.10 },
    'Canon':        { default: 1.10 },
    'Nikon':        { default: 1.10 },
    'Bose':         { default: 1.15 },
    'Dell':         { default: 1.05 },
    'HP':           { default: 1.03 },
    'Lenovo':       { default: 1.03 },
    'Xiaomi':       { default: 0.95 },
    'OPPO':         { default: 0.95 },
    'Vivo':         { default: 0.95 },
    'Realme':       { default: 0.92 },
    'Huawei':       { default: 0.95 },
    'Gucci':        { default: 1.30 },
    'Louis Vuitton':{ default: 1.35 },
    'Prada':        { default: 1.30 },
    'Chanel':       { default: 1.35 },
    'Hermes':       { default: 1.40 },
    'Rolex':        { default: 1.35 },
    'Omega':        { default: 1.25 },
};

const CATEGORY_DEMAND = {
    'Smartphones':      1.20,
    'Laptops':          1.05,
    'TVs':              1.00,
    'Tablets':          1.05,
    'Cameras':          1.05,
    'Gaming Consoles':  1.10,
    'Headphones':       1.00,
    'Smartwatches':     1.00,
    'Electronics':      1.00,
    'Fashion':          0.80,
    'Home & Garden':    0.95,
    'Sports':           0.95,
    'Collectibles':     1.05,
    'Other':            0.95,
};

function getPHConditionFactor(condition) {
    return CONDITION_FACTORS[condition] ?? 0.45;
}

function getPHAgeFactor(age) {
    if (!age || age <= 0) return 1.00;
    if (age < 1)  return 1.00;
    if (age < 2)  return 0.92;
    if (age < 3)  return 0.82;
    if (age < 5)  return 0.68;
    return Math.max(0.45, 0.68 - (age - 5) * 0.05);
}

function getPHBrandPremium(brand, category) {
    if (!brand) return 0.80;
    const entry = BRAND_PREMIUMS[brand];
    if (!entry) return 1.00;
    return entry[category] ?? entry.default ?? 1.00;
}

function getPHCategoryDemand(category, name = '') {
    if (/iphone|macbook|ipad|airpods|apple watch/i.test(name)) return 1.15;
    return CATEGORY_DEMAND[category] ?? 1.00;
}

function getPHSpecMultiplier(specs = {}, keywords = []) {
    let m = 1.00;
    const has = (...terms) => terms.some(t => keywords.includes(t));

    const storage = parseInt(specs.storage || '0');
    if (storage >= 512) m *= 1.15;
    else if (storage >= 256) m *= 1.08;

    if (has('oled')) m *= 1.12;
    else if (has('qled')) m *= 1.08;
    if (has('4k', 'uhd')) m *= 1.08;
    if (has('5g')) m *= 1.10;
    if (has('box') && has('accessories')) m *= 1.08;
    if (has('warranty')) m *= 1.10;
    if (has('sealed') || has('factory')) m *= 1.05;
    if (has('limited edition') || has('rare')) m *= 1.20;

    return Math.min(m, 1.60);
}

/**
 * Apply PH secondhand pricing formula to a known PH SRP.
 * Returns the estimated secondhand market price in PHP.
 */
export function applyPHFormula(srp, productInfo) {
    const condition = getPHConditionFactor(productInfo.condition);
    const age      = getPHAgeFactor(productInfo.specs?.age);
    const brand    = getPHBrandPremium(productInfo.brand, productInfo.category);
    const demand   = getPHCategoryDemand(productInfo.category, productInfo.name);
    const spec     = getPHSpecMultiplier(productInfo.specs, productInfo.keywords);

    return Math.max(100, Math.round(srp * condition * age * brand * demand * spec));
}

export function getPHFormulaBreakdown(srp, productInfo) {
    const condition = getPHConditionFactor(productInfo.condition);
    const age      = getPHAgeFactor(productInfo.specs?.age);
    const brand    = getPHBrandPremium(productInfo.brand, productInfo.category);
    const demand   = getPHCategoryDemand(productInfo.category, productInfo.name);
    const spec     = getPHSpecMultiplier(productInfo.specs, productInfo.keywords);
    const result   = Math.max(100, Math.round(srp * condition * age * brand * demand * spec));

    return { srp, condition, age, brand, demand, spec, result };
}

/**
 * Legacy: kept for callers that still pass basePrice directly.
 */
export function calculateFeatureAdjustment(productInfo, basePrice) {
    const spec = getPHSpecMultiplier(productInfo.specs, productInfo.keywords);
    const age  = getPHAgeFactor(productInfo.specs?.age);
    return Math.round(basePrice * spec * age);
}


export default {
    extractProductInfo,
    calculateFeatureAdjustment,
    applyPHFormula,
    getPHFormulaBreakdown
};
