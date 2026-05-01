// Product analyzer utilities
// Note: This module no longer uses local marketDataset.json
// All market data comes from the Mercari dataset

/**
 * Extract detailed product information from name and description
 */
export function extractProductInfo(product) {
    const { name, description, brand, condition, category, specifications } = product;

    const combined = `${name} ${description} ${specifications || ''}`.toLowerCase();

    return {
        brand: brand || extractBrand(combined),
        model: extractModel(name),
        specs: extractSpecs(combined, category),
        keywords: extractKeywords(combined),
        condition: condition || 'Used',
        category: normalizeCategory(category || detectCategory(combined))
    };
}

/**
 * Normalize category string to match Mercari dataset categories
 */
function normalizeCategory(category) {
    if (!category) return 'Other';

    const normalized = category.toLowerCase();

    if (category.includes(':')) {
        const main = category.split(':')[0].toLowerCase();
        const mapping = {
            electronics: 'Electronics',
            fashion: 'Fashion',
            home: 'Home & Garden',
            culture: 'Collectibles',
            sports: 'Sports',
            automotive: 'Other'
        };
        return mapping[main] || 'Other';
    }

    if (
        normalized.includes('phone') ||
        normalized.includes('tablet') ||
        normalized.includes('laptop') ||
        normalized.includes('computer') ||
        normalized.includes('camera') ||
        normalized.includes('gaming') ||
        normalized.includes('audio') ||
        normalized.includes('tv') ||
        normalized.includes('electronic')
    ) {
        return 'Electronics';
    }

    if (
        normalized.includes('fashion') ||
        normalized.includes('clothing') ||
        normalized.includes('shoe') ||
        normalized.includes('bag') ||
        normalized.includes('watch') ||
        normalized.includes('jewelry')
    ) {
        return 'Fashion';
    }

    if (
        normalized.includes('home') ||
        normalized.includes('kitchen') ||
        normalized.includes('furniture') ||
        normalized.includes('garden')
    ) {
        return 'Home & Garden';
    }

    if (
        normalized.includes('sport') ||
        normalized.includes('outdoor') ||
        normalized.includes('bicycle')
    ) {
        return 'Sports';
    }

    if (
        normalized.includes('collectible') ||
        normalized.includes('vintage') ||
        normalized.includes('culture') ||
        normalized.includes('instrument')
    ) {
        return 'Collectibles';
    }

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
        'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Microsoft', 'Razer',
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

    // Year
    const yearMatch = text.match(/(20\d{2})/);
    if (yearMatch) {
        specs.year = parseInt(yearMatch[1]);
        specs.age = new Date().getFullYear() - specs.year;
    }

    return specs;
}

/**
 * Extract relevant keywords
 */
function extractKeywords(text) {
    const keywords = [];

    const importantKeywords = [
        'unlocked', 'factory', 'sealed', 'warranty', 'box', 'accessories',
        'charger', 'case', 'screen protector', 'original', 'authentic',
        'limited edition', 'rare', 'vintage', 'collectible', 'mint',
        'water resistant', 'wireless', 'bluetooth', 'wifi', '5g', 'lte',
        'gaming', 'professional', 'business', 'student', 'portable'
    ];

    for (const keyword of importantKeywords) {
        if (text.includes(keyword)) {
            keywords.push(keyword);
        }
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


/**
 * Calculate price adjustment based on product features
 */
export function calculateFeatureAdjustment(productInfo, basePrice) {
    let multiplier = 1.0;
    const { keywords, specs, brand } = productInfo;

    // Positive adjustments
    if (keywords.includes('sealed') || keywords.includes('factory')) multiplier *= 1.15;
    if (keywords.includes('warranty')) multiplier *= 1.10;
    if (keywords.includes('box') && keywords.includes('accessories')) multiplier *= 1.08;
    if (keywords.includes('unlocked')) multiplier *= 1.05;
    if (keywords.includes('limited edition') || keywords.includes('rare')) multiplier *= 1.20;
    if (keywords.includes('authentic')) multiplier *= 1.05;

    // Age adjustment
    if (specs.age !== undefined) {
        if (specs.age === 0) multiplier *= 1.10; // Brand new this year
        else if (specs.age === 1) multiplier *= 0.95;
        else if (specs.age === 2) multiplier *= 0.85;
        else if (specs.age >= 3) multiplier *= Math.max(0.60, 0.85 - (specs.age - 2) * 0.05);
    }

    // Storage adjustment (higher storage = higher value)
    if (specs.storage) {
        const storage = parseInt(specs.storage);
        if (storage >= 512) multiplier *= 1.15;
        else if (storage >= 256) multiplier *= 1.10;
        else if (storage <= 64) multiplier *= 0.95;
    }

    // Premium brands
    const premiumBrands = ['Apple', 'Samsung', 'Sony', 'Canon', 'Nikon', 'Bose'];
    if (brand && premiumBrands.includes(brand)) {
        multiplier *= 1.05;
    }

    return Math.round(basePrice * multiplier);
}


export default {
    extractProductInfo,
    calculateFeatureAdjustment
};
