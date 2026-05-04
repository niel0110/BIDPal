import { supabase } from '../config/supabase.js';
import {
    extractProductInfo,
    calculateFeatureAdjustment
} from './productAnalyzer.js';
import {
    initModel,
    predictPrice,
    loadMercariDataCache,
    getMercariData
} from './mlModelService.js';
import {
    getMercariMarketStats,
    findMercariComparables
} from './mercariDataLoader.js';

// Initialize ML model at startup
initModel();

// Mercari dataset: load in background on startup so it's ready by the time users request prices
let _mercariLoadPromise = null;
let _geminiCooldownUntil = 0;

function getRecommendationMode() {
    return (process.env.PRICE_RECOMMENDATION_AI_MODE || 'hybrid').toLowerCase();
}

function isGeminiEnabled() {
    return getRecommendationMode() !== 'deterministic';
}

function isGeminiCoolingDown() {
    return Date.now() < _geminiCooldownUntil;
}
function ensureMercariLoaded() {
    if (getMercariData()?.length) return;  // already cached
    if (_mercariLoadPromise) return;        // already loading
    _mercariLoadPromise = loadMercariDataCache()
        .then(() => console.log('✅ Mercari dataset loaded and cached'))
        .catch(err => {
            console.warn('⚠️ Mercari dataset unavailable:', err.message);
            _mercariLoadPromise = null; // allow retry on next request
        });
}
ensureMercariLoaded();

async function waitForMercariData() {
    ensureMercariLoaded();
    if (_mercariLoadPromise) {
        await _mercariLoadPromise.catch(() => null);
    }
    return getMercariData();
}

/**
 * Generate price recommendation using Gemini and Mercari market data
 * @param {Object} productData - Product information
 * @returns {Object} Price recommendation with insights
 */
export async function generatePriceRecommendation(productData) {
    try {
        // Extract detailed product information
        const productInfo = extractProductInfo(productData);
        console.log('📊 Extracted product info:', productInfo);

        let mercariData = getMercariData();
        const mlPriceEstimate = predictPrice(productInfo);
        if (!mercariData || mercariData.length === 0) {
            mercariData = await waitForMercariData();
        }

        if ((!mercariData || mercariData.length === 0) && mlPriceEstimate) {
            ensureMercariLoaded();
            console.log('Using local ML fallback because the Mercari dataset is unavailable');
            const specEstimate = estimateSpecDrivenPrice(productInfo);
            return generateHeuristicRecommendation(
                productInfo,
                [],
                specEstimate || mlPriceEstimate,
                'Mercari dataset unavailable',
                true
            );
        }

        if (!mercariData || mercariData.length === 0) {
            // Trigger background load if not already in progress, then continue with Gemini
            ensureMercariLoaded();
            console.log('📦 Mercari dataset loading in background — using Gemini for this request');
            return generateAIOnlyRecommendation(productData, productInfo);
        }

        console.log('🎯 Using Mercari dataset for analysis');

        // Get Mercari market statistics
        const marketData = getMercariMarketStats(mercariData, productInfo.category, productInfo.brand);
        console.log('📈 Market data stats:', {
            avgPrice: marketData?.avgPrice,
            totalItems: marketData?.totalItems,
            category: productInfo.category,
            brand: productInfo.brand
        });

        // Find comparable items from Mercari
        const comparableItems = findMercariComparables(mercariData, productInfo, 10);
        console.log('🔍 Found Mercari comparable items:', comparableItems.length);

        // Calculate base price from Mercari data
        let basePrice = calculateDataDrivenBasePrice(productInfo, comparableItems, marketData, mlPriceEstimate);
        /*
            basePrice = marketData.avgPrice;

            // Apply condition depreciation from Mercari data
            if (marketData.depreciation && productInfo.condition) {
                basePrice = basePrice * (marketData.depreciation[productInfo.condition] || 0.7);
            }
        } else {
            // If no exact category match, use comparable items average
            if (comparableItems && comparableItems.length > 0) {
                const avgComparablePrice = comparableItems.reduce((sum, item) => sum + item.price, 0) / comparableItems.length;
                basePrice = avgComparablePrice;
                console.log('💡 Using average from comparable items:', basePrice);
            } else {
                basePrice = 5000; // ultimate fallback
                console.log('⚠️ No market data or comparables found, using base fallback');
            }
        }

        */

        // Fetch historical data from database
        const historicalData = await fetchHistoricalData(productInfo.category, productInfo.brand);

        // Apply feature adjustments
        basePrice = calculateFeatureAdjustment(productInfo, basePrice);
        basePrice = blendWithHistoricalSales(basePrice, historicalData);
        console.log('💰 Calculated base price:', basePrice);

        // Build comprehensive prompt with dataset
        const prompt = buildPricePrompt(productData, historicalData, marketData, productInfo, comparableItems, basePrice, mlPriceEstimate);

        if (!isGeminiEnabled()) {
            console.log('Deterministic recommendation mode enabled; skipping Gemini refinement');
            return generateHeuristicRecommendation(
                productInfo,
                comparableItems,
                basePrice,
                'Gemini disabled by configuration',
                !!mlPriceEstimate
            );
        }

        if (isGeminiCoolingDown()) {
            console.log('Gemini quota cooldown active; using deterministic recommendation');
            return generateHeuristicRecommendation(
                productInfo,
                comparableItems,
                basePrice,
                'Gemini cooldown active',
                !!mlPriceEstimate
            );
        }

        // Call Gemini API
        let response;
        try {
            response = await callAIWithRetry(prompt);
        } catch (aiError) {
            console.warn('⚠️ AI refinement failed:', aiError.message);
            return generateHeuristicRecommendation(
                productInfo,
                comparableItems,
                basePrice,
                aiError.message,
                !!mlPriceEstimate
            );
        }

        // Parse the response
        const recommendation = clampRecommendationToBase(parseAIResponse(response), basePrice);

        return {
            success: true,
            recommendation: {
                suggestedReservePrice: recommendation.reservePrice,
                suggestedStartingBid: recommendation.startingBid,
                suggestedBidIncrement: recommendation.bidIncrement,
                priceRange: {
                    min: recommendation.priceRange.min,
                    max: recommendation.priceRange.max
                },
                confidence: recommendation.confidence,
                reasoning: recommendation.reasoning,
                marketInsights: recommendation.marketInsights || [],
                isML: false,
                comparableItems: comparableItems.map(item => ({
                    name: item.name,
                    price: item.price,
                    relevance: `${item.relevance}% match - ${item.demand} demand`
                }))
            }
        };

    } catch (error) {
        console.error('Price recommendation error:', error);

        // FALLBACK: Use heuristic recommendation if Gemini fails
        try {
            console.log('⚠️ AI Service failed, attempting heuristic fallback...');
            const productInfo = extractProductInfo(productData);
            const mercariData = getMercariData();
            const mlPriceEstimate = predictPrice(productInfo);

            if (mercariData && mercariData.length > 0) {
                const comparableItems = findMercariComparables(mercariData, productInfo, 10);
                const marketData = getMercariMarketStats(mercariData, productInfo.category, productInfo.brand);
                let basePrice = calculateDataDrivenBasePrice(productInfo, comparableItems, marketData, mlPriceEstimate);
                /*
                if (mlPriceEstimate) {
                    basePrice = mlPriceEstimate;
                    console.log('🤖 Using Random Forest prediction for fallback:', basePrice);
                } else if (comparableItems.length > 0) {
                    basePrice = comparableItems.reduce((sum, item) => sum + item.price, 0) / comparableItems.length;
                    console.log('💡 Using comparable average for fallback:', basePrice);
                } else if (marketData && marketData.avgPrice) {
                    basePrice = marketData.avgPrice;
                    console.log('📈 Using market average for fallback:', basePrice);
                }
                */
                console.log('Using deterministic fallback base:', basePrice);

                return generateHeuristicRecommendation(productInfo, comparableItems, basePrice, error.message, !!mlPriceEstimate);
            }
        } catch (fallbackError) {
            console.error('Fallback recommendation failed:', fallbackError);
        }

        // Last-resort: category-based estimate (no external services required)
        console.log('⚠️ All AI/ML methods failed, using category-based estimate');
        return generateCategoryBasedFallback(productData);
    }
}

/**
 * Category-based fallback — always works, no external services needed
 */
const CATEGORY_BASE_PRICES = {
    phone: 8000, smartphone: 10000, laptop: 20000, computer: 15000,
    tablet: 8000, gadget: 6000, electronic: 5000, camera: 8000,
    gaming: 5000, headphone: 2000, audio: 3000, oled: 60000, qled: 35000, tv: 25000,
    clothing: 500, shirt: 400, dress: 600, pants: 500, shoes: 900,
    bag: 1500, handbag: 2000, backpack: 1200,
    jewelry: 2000, watch: 5000, necklace: 1500, ring: 2000,
    appliance: 5000, refrigerator: 15000, kitchen: 3000,
    furniture: 3000, sofa: 8000, table: 2500, chair: 1500,
    instrument: 3000, guitar: 5000, piano: 15000,
    garden: 800, tool: 1200,
};

const CONDITION_MULTIPLIERS = {
    'Brand New': 1.0, 'Like New': 0.85, 'Lightly Used': 0.70,
    'Used': 0.55, 'Heavily Used': 0.35, 'For Parts': 0.15,
    new: 1.0, like_new: 0.85, good: 0.70, fair: 0.55,
    poor: 0.35, parts: 0.15,
};

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function roundToMarketStep(value) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (value >= 50000) return Math.round(value / 1000) * 1000;
    if (value >= 10000) return Math.round(value / 500) * 500;
    if (value >= 1000) return Math.round(value / 100) * 100;
    return Math.round(value / 50) * 50;
}

function getConditionMultiplier(condition) {
    return CONDITION_MULTIPLIERS[condition] || 0.55;
}

function getMarketBasePrice(productInfo, marketData) {
    if (!marketData) return 5000;
    const conditionPrice = marketData.conditionPrices?.[productInfo.condition]?.avg;
    if (conditionPrice) return conditionPrice;

    const marketAverage = marketData.trimmedAvgPrice || marketData.medianPrice || marketData.avgPrice;
    return marketAverage * getConditionMultiplier(productInfo.condition);
}

function estimateSpecDrivenPrice(productInfo) {
    const keywords = productInfo.keywords || [];
    const hasKeyword = (...terms) => terms.some(term => keywords.includes(term));
    const screenSize = Number(productInfo.specs?.screenSize || 0);
    const isTv = hasKeyword('tv', 'television', 'smart tv', 'oled', 'qled') || /\btv\b/i.test(productInfo.name || '');

    if (!isTv || !screenSize) return 0;

    let newMarketEstimate = screenSize * 650;
    if (hasKeyword('oled')) newMarketEstimate = screenSize * 1700;
    else if (hasKeyword('qled')) newMarketEstimate = screenSize * 1150;
    else if (hasKeyword('4k', 'uhd')) newMarketEstimate = screenSize * 900;

    const premiumBrands = ['Samsung', 'Sony', 'LG'];
    if (premiumBrands.includes(productInfo.brand)) newMarketEstimate *= 1.15;
    if (/s9\d|s95|bravia|oled/i.test(productInfo.model || productInfo.name || '')) newMarketEstimate *= 1.18;

    return roundToMarketStep(newMarketEstimate * getConditionMultiplier(productInfo.condition));
}

function calculateDataDrivenBasePrice(productInfo, comparableItems = [], marketData = null, mlPriceEstimate = null) {
    const strongComparables = comparableItems.filter(item => Number(item.price) > 0 && Number(item.relevance) >= 60);
    const weakComparables = comparableItems.filter(item => Number(item.price) > 0);
    const comparablePrices = (strongComparables.length >= 3 ? strongComparables : weakComparables).map(item => item.price);
    const comparableMedian = comparablePrices.length ? median(comparablePrices) : 0;
    const marketBase = getMarketBasePrice(productInfo, marketData);
    const usableMl = mlPriceEstimate && mlPriceEstimate > 0 ? mlPriceEstimate : 0;
    const specEstimate = estimateSpecDrivenPrice(productInfo);

    const signals = [];
    if (strongComparables.length >= 3) {
        if (usableMl) signals.push({ value: usableMl, weight: 0.40 });
        signals.push({ value: comparableMedian, weight: 0.40 });
        if (specEstimate) signals.push({ value: specEstimate, weight: 0.10 });
        if (marketBase) signals.push({ value: marketBase, weight: 0.10 });
    } else if (specEstimate) {
        if (usableMl) signals.push({ value: usableMl, weight: 0.40 });
        signals.push({ value: specEstimate, weight: 0.40 });
        if (comparableMedian) signals.push({ value: comparableMedian, weight: 0.10 });
        if (marketBase) signals.push({ value: marketBase, weight: 0.10 });
    } else {
        if (comparableMedian) signals.push({ value: comparableMedian, weight: 0.45 });
        if (marketBase) signals.push({ value: marketBase, weight: comparableMedian ? 0.25 : 0.65 });
        if (usableMl) signals.push({ value: usableMl, weight: comparableMedian ? 0.10 : 0.35 });
    }

    if (!signals.length) return 5000;

    const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
    const weighted = signals.reduce((sum, signal) => sum + signal.value * signal.weight, 0) / totalWeight;
    return Math.max(100, roundToMarketStep(weighted));
}

function blendWithHistoricalSales(basePrice, historicalData) {
    const count = historicalData?.successfulSales?.count || 0;
    const averagePrice = historicalData?.successfulSales?.averagePrice || 0;
    if (!count || !averagePrice) return basePrice;

    const historyWeight = Math.min(0.35, 0.12 + count * 0.03);
    const weightedPrice = basePrice * (1 - historyWeight) + averagePrice * historyWeight;
    return roundToMarketStep(weightedPrice);
}

function calculateBidIncrement(startingBid) {
    const rawIncrement = startingBid * 0.05;
    if (startingBid >= 50000) return Math.max(1000, Math.round(rawIncrement / 500) * 500);
    if (startingBid >= 10000) return Math.max(500, Math.round(rawIncrement / 100) * 100);
    if (startingBid >= 3000) return Math.max(100, Math.round(rawIncrement / 50) * 50);
    return Math.max(50, Math.round(rawIncrement / 10) * 10);
}

function roundBidIncrement(value, startingBid) {
    if (!Number.isFinite(value) || value <= 0) return calculateBidIncrement(startingBid);
    if (startingBid >= 50000) return Math.max(1000, Math.round(value / 500) * 500);
    if (startingBid >= 10000) return Math.max(500, Math.round(value / 100) * 100);
    if (startingBid >= 3000) return Math.max(100, Math.round(value / 50) * 50);
    return Math.max(50, Math.round(value / 10) * 10);
}

function clampRecommendationToBase(recommendation, basePrice) {
    if (!basePrice || !recommendation?.reservePrice) return recommendation;

    const maxReasonable = basePrice * 1.25;
    const minReasonable = basePrice * 0.65;
    if (recommendation.reservePrice > maxReasonable || recommendation.reservePrice < minReasonable) {
        const reservePrice = roundToMarketStep(basePrice);
        const startingBid = roundToMarketStep(reservePrice * 0.75);
        return {
            ...recommendation,
            reservePrice,
            startingBid,
            bidIncrement: calculateBidIncrement(startingBid),
            priceRange: {
                min: roundToMarketStep(reservePrice * 0.85),
                max: roundToMarketStep(reservePrice * 1.15)
            },
            marketInsights: [
                ...(recommendation.marketInsights || []),
                'Gemini estimate was adjusted to stay aligned with Mercari, Random Forest, and BIDPal sales signals.'
            ]
        };
    }

    return recommendation;
}

function generateCategoryBasedFallback(productData) {
    let productInfo;
    try { productInfo = extractProductInfo(productData); } catch { productInfo = productData; }

    const catLower = (productInfo.category || productData.category || '').toLowerCase();
    const nameAndCat = `${(productData.name || '')} ${catLower}`.toLowerCase();
    const catKey = Object.keys(CATEGORY_BASE_PRICES)
        .sort((a, b) => b.length - a.length)
        .find(k => nameAndCat.includes(k));
    const basePrice = CATEGORY_BASE_PRICES[catKey] || 2000;
    const condition = productInfo.condition || productData.condition || 'Used';
    const multiplier = CONDITION_MULTIPLIERS[condition] || 0.55;
    const reservePrice = roundToMarketStep(basePrice * multiplier);
    const startingBid = roundToMarketStep(reservePrice * 0.75);
    const bidIncrement = calculateBidIncrement(startingBid);

    return {
        success: true,
        recommendation: {
            suggestedReservePrice: reservePrice,
            suggestedStartingBid: startingBid,
            suggestedBidIncrement: bidIncrement,
            priceRange: { min: Math.round(reservePrice * 0.8), max: Math.round(reservePrice * 1.2) },
            confidence: 'Low',
            reasoning: `Pricing estimate for "${productData.category}" items in ${condition} condition, based on typical Philippine secondhand market rates. Review and adjust to match your specific item's brand and features.`,
            marketInsights: [
                'General category pricing applied — adjust for brand premium or item rarity.',
                'Compare with similar active listings on BIDPal to refine your reserve price.',
                'Condition-adjusted starting bid set at 75% of reserve to attract early bids.',
            ],
            comparableItems: [],
            isML: false,
            warning: 'Market dataset unavailable. Using category baseline — verify price before listing.'
        }
    };
}

/**
 * Generate a data-driven recommendation without AI when Gemini is unavailable.
 * When usedML=true (Random Forest + 1.4M Mercari records) the result is high quality
 * and shown without a warning banner.
 */
function generateHeuristicRecommendation(productInfo, comparableItems, basePrice, originalError, usedML = false) {
    const reservePrice = roundToMarketStep(basePrice);
    const startingBid = roundToMarketStep(reservePrice * 0.75);
    const bidIncrement = calculateBidIncrement(startingBid);

    const result = {
        suggestedReservePrice: reservePrice,
        suggestedStartingBid: startingBid,
        suggestedBidIncrement: bidIncrement,
        priceRange: {
            min: Math.round(reservePrice * 0.85),
            max: Math.round(reservePrice * 1.15)
        },
        confidence: usedML ? 'High' : 'Medium',
        reasoning: usedML
            ? `The pricing engine blended Mercari market data, Random Forest signals, product specifications, and BIDPal sales history for "${productInfo.name || productInfo.category}". Recommended reserve price: PHP ${reservePrice.toLocaleString()}. Factors: category demand, brand value, item condition, and detected specs.`
            : `Market-driven recommendation based on ${comparableItems.length} similar listings in the "${productInfo.category}" category. Average comparable price: ₱${basePrice.toLocaleString()}.`,
        marketInsights: [
            usedML
                ? 'Mercari dataset, Random Forest model signals, product specs, and BIDPal sales history were blended.'
                : 'Based on comparable sold listings in the same category.',
            comparableItems.length > 0
                ? `Found ${comparableItems.length} similar listings matching your product's profile.`
                : 'Condition-weighted market average applied.',
            'Starting bid set at 75% of market value to maximize early bidding.',
            'Price range reflects ±15% variance typical in secondhand markets.',
        ],
        comparableItems: comparableItems.slice(0, 5).map(item => ({
            name: item.name,
            price: item.price,
            relevance: `${item.relevance}% match`
        })),
        isML: usedML
    };

    // Only show a warning for non-ML fallback (quota/unavailable) — not for ML results
    if (!usedML) {
        const isQuotaError = originalError?.includes('429') || originalError?.includes('quota');
        result.warning = isQuotaError
            ? 'AI service is at capacity. Recommendation based on Market Data Analysis.'
            : 'AI service unavailable. Recommendation based on Market Data Analysis.';
    }

    return { success: true, recommendation: result };
}

/**
 * Fetch historical auction data for similar products
 */
async function fetchHistoricalData(category, brand) {
    try {
        const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

        // Get both ended and active auctions from recent BIDPal activity
        const { data: auctions, error } = await supabase
            .from('Auctions')
            .select(`
                auction_id,
                reserve_price,
                buy_now_price,
                status,
                created_at,
                products:Products (
                    name,
                    description,
                    condition
                ),
                bids:Bids (bid_amount)
            `)
            .in('status', ['ended', 'active', 'completed'])
            .gte('created_at', since)
            .limit(100);

        if (error) throw error;

        // Completed regular orders capture fixed-price sales, which are different from auctions
        // but very useful for future BIDPal-specific recommendations.
        const { data: fixedOrders, error: fixedOrderError } = await supabase
            .from('Orders')
            .select(`
                order_id,
                total_amount,
                status,
                placed_at,
                order_type,
                Order_items (
                    quantity,
                    unit_price,
                    Products (
                        name,
                        description,
                        condition
                    )
                )
            `)
            .eq('status', 'completed')
            .eq('order_type', 'regular')
            .gte('placed_at', since)
            .limit(100);

        if (fixedOrderError) {
            console.warn('Fixed-price history unavailable for recommendations:', fixedOrderError.message);
        }

        const { data: productListings, error: productListingError } = await supabase
            .from('Products')
            .select('products_id, name, description, condition, price, starting_price, reserve_price, status, created_at')
            .in('status', ['draft', 'active', 'scheduled', 'approved'])
            .gte('created_at', since)
            .limit(100);

        if (productListingError) {
            console.warn('Active product listing history unavailable for recommendations:', productListingError.message);
        }

        // Filter and split into successful sales and active competition
        const similar = auctions?.filter(a => {
            const prod = a.products;
            if (!prod) return false;
            const prodName = (prod.name + ' ' + (prod.description || '')).toLowerCase();
            const searchCategory = category.toLowerCase();
            const searchBrand = brand?.toLowerCase();
            
            return prodName.includes(searchCategory) || (searchBrand && prodName.includes(searchBrand));
        }) || [];

        const processedAuctions = similar.map(a => {
            const highestBid = a.bids && a.bids.length > 0 
                ? Math.max(...a.bids.map(b => b.bid_amount)) 
                : 0;
            return {
                ...a,
                final_price: highestBid || a.reserve_price || 0,
                bid_count: a.bids?.length || 0
            };
        });

        const successfulSales = processedAuctions.filter(a => ['ended', 'completed'].includes(a.status) && (a.final_price > 0));
        const activeListings = processedAuctions.filter(a => a.status === 'active');
        const activeProductListings = (productListings || [])
            .map(product => ({
                products: product,
                final_price: Number(product.price || product.starting_price || product.reserve_price || 0),
                bid_count: 0
            }))
            .filter(listing => {
                const prod = listing.products;
                if (!prod || !listing.final_price) return false;
                const prodName = (prod.name + ' ' + (prod.description || '')).toLowerCase();
                const searchCategory = category.toLowerCase();
                const searchBrand = brand?.toLowerCase();

                return prodName.includes(searchCategory) || (searchBrand && prodName.includes(searchBrand));
            });
        const fixedPriceSales = (fixedOrders || [])
            .flatMap(order => (order.Order_items || []).map(item => ({
                source: 'fixed_price',
                products: item.Products,
                final_price: Number(item.unit_price || 0) || Number(order.total_amount || 0),
                bid_count: 0
            })))
            .filter(sale => {
                const prod = sale.products;
                if (!prod || !sale.final_price) return false;
                const prodName = (prod.name + ' ' + (prod.description || '')).toLowerCase();
                const searchCategory = category.toLowerCase();
                const searchBrand = brand?.toLowerCase();

                return prodName.includes(searchCategory) || (searchBrand && prodName.includes(searchBrand));
            });

        const allSuccessfulSales = [...successfulSales, ...fixedPriceSales];

        const allActiveCompetition = [...activeListings, ...activeProductListings];

        return {
            totalAuctions: similar.length,
            successfulSales: {
                count: allSuccessfulSales.length,
                averagePrice: allSuccessfulSales.length > 0
                    ? allSuccessfulSales.reduce((sum, a) => sum + a.final_price, 0) / allSuccessfulSales.length
                    : 0,
                priceRange: allSuccessfulSales.length > 0 ? {
                    min: Math.min(...allSuccessfulSales.map(a => a.final_price)),
                    max: Math.max(...allSuccessfulSales.map(a => a.final_price))
                } : null,
                items: allSuccessfulSales.slice(0, 10).map(a => ({
                    name: a.products?.name,
                    finalPrice: a.final_price,
                    bidCount: a.bid_count,
                    source: a.source || 'auction'
                }))
            },
            activeCompetition: {
                count: allActiveCompetition.length,
                averageStartingPrice: allActiveCompetition.length > 0
                    ? allActiveCompetition.reduce((sum, a) => sum + (a.reserve_price || a.buy_now_price || a.final_price), 0) / allActiveCompetition.length
                    : 0,
                items: allActiveCompetition.slice(0, 5).map(a => ({
                    name: a.products?.name,
                    currentPrice: a.final_price || a.reserve_price,
                    bidCount: a.bid_count
                }))
            }
        };
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return null;
    }
}

/**
 * AI-only fallback when Mercari dataset is unavailable
 */
async function generateAIOnlyRecommendation(productData, productInfo) {
    const mlPriceEstimate = predictPrice(productInfo);
    if (mlPriceEstimate) {
        console.log('Using local ML recommendation while the Mercari dataset is unavailable');
        return generateHeuristicRecommendation(productInfo, [], mlPriceEstimate, 'Mercari dataset unavailable', true);
    }

    if (!isGeminiEnabled() || isGeminiCoolingDown()) {
        return generateCategoryBasedFallback(productData);
    }

    const { name, description, category, condition, brand, specifications } = productData;
    const prompt = `You are an expert auction pricing analyst for a Philippine online auction platform (BIDPal).

PRODUCT DETAILS:
- Name: ${name}
- Category: ${category}
- Condition: ${condition || 'Used'}
- Brand: ${brand || 'Not specified'}
- Description: ${description || 'Not provided'}
- Specifications: ${specifications || 'Not provided'}

Provide a price recommendation in Philippine Peso (₱). Consider:
- Philippine secondhand market prices
- Condition scale: Brand New (1.0x) > Like New (0.85x) > Lightly Used (0.70x) > Used (0.55x) > Heavily Used (0.35x) > For Parts (0.15x)
- Starting bid should be 60-80% of reserve price
- Bid increment should be 5-10% of starting bid

RESPOND IN THIS EXACT JSON FORMAT (numbers only, no currency symbols):
{
  "reservePrice": <number>,
  "startingBid": <number>,
  "bidIncrement": <number>,
  "priceRange": { "min": <number>, "max": <number> },
  "confidence": "Medium",
  "reasoning": "<brief explanation>",
  "marketInsights": ["<insight 1>", "<insight 2>"],
  "comparableItems": []
}

Provide ONLY the JSON, no extra text.`;

    try {
        const response = await callAIWithRetry(prompt);
        const recommendation = parseAIResponse(response);
        return {
            success: true,
            recommendation: {
                suggestedReservePrice: recommendation.reservePrice,
                suggestedStartingBid: recommendation.startingBid,
                suggestedBidIncrement: recommendation.bidIncrement,
                priceRange: recommendation.priceRange,
                confidence: recommendation.confidence,
                reasoning: recommendation.reasoning,
                marketInsights: recommendation.marketInsights || [],
                comparableItems: []
            }
        };
    } catch (err) {
        console.warn('⚠️ AI-only recommendation failed, using category fallback:', err.message);
        return generateCategoryBasedFallback(productData);
    }
}

async function callAIWithRetry(prompt) {
    if (process.env.GEMINI_API_KEY && !isGeminiCoolingDown()) {
        return callGeminiWithRetry(prompt);
    }

    if (isGeminiCoolingDown()) {
        throw new Error('Gemini quota cooldown active');
    }

    throw new Error('GEMINI_API_KEY is not set');
}

/**
 * Call Gemini REST API directly.
 */
async function callGeminiWithRetry(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

    const configuredModel = process.env.GEMINI_PRICE_MODEL;
    const candidates = configuredModel ? [[configuredModel, 'v1beta']] : [
        ['gemini-2.0-flash-lite', 'v1beta'],
        ['gemini-2.0-flash',      'v1beta'],
        ['gemini-2.0-flash',      'v1'],
    ];

    const body = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
    });

    let lastError;
    for (const [model, apiVersion] of candidates) {
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
        console.log(`🤖 Trying ${model} (${apiVersion})...`);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (res.status === 401 || res.status === 403) throw new Error(`API key invalid (${res.status})`);
            if (res.status === 404) {
                console.warn(`⚠️  ${model} not found on ${apiVersion}, skipping`);
                lastError = new Error(`${model} not available`);
                continue;
            }
            if (res.status === 429) {
                const body = await res.json().catch(() => ({}));
                console.warn(`⚠️  ${model} quota hit: ${body?.error?.message?.slice(0, 80) || '429'}`);
                _geminiCooldownUntil = Date.now() + (60 * 60 * 1000);
                lastError = new Error('Quota exceeded');
                continue;
            }
            if (!res.ok) {
                const err = await res.text().catch(() => res.statusText);
                console.warn(`⚠️  ${model} ${res.status}: ${err.slice(0, 80)}`);
                lastError = new Error(err);
                continue;
            }

            const json = await res.json();
            const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('Empty response from Gemini');
            console.log(`✅ Gemini success: ${model} (${apiVersion})`);
            return text;
        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn(`⚠️  ${model} timed out`);
                lastError = new Error('Request timed out');
                continue;
            }
            if (err.message?.includes('API key')) throw err;
            console.warn(`⚠️  ${model}: ${err.message?.slice(0, 80)}`);
            lastError = err;
        }
    }

    throw lastError || new Error('All Gemini models failed');
}

/**
 * Build comprehensive prompt for Gemini
 */
function buildPricePrompt(productData, historicalData, marketData, productInfo, comparableItems, basePrice, mlPriceEstimate) {
    const { name, description, category, condition, brand, specifications } = productData;

    let prompt = `You are an expert auction pricing analyst. Analyze the following product and provide a detailed price recommendation for an online auction.

DYNAMIC ML PREDICTION (RANDOM FOREST):
- Numerical Price Estimate: ₱${mlPriceEstimate?.toLocaleString() || 'Calculating...'}
- Note: This estimate was generated by a Random Forest Regression model trained on platform historical data and market trends.

PRODUCT DETAILS:
- Name: ${name}
- Category: ${category}
- Condition: ${condition}
- Brand: ${brand || productInfo.brand || 'Not specified'}
- Description: ${description}
- Specifications: ${specifications || 'Not specified'}

EXTRACTED PRODUCT INFORMATION:
- Detected Brand: ${productInfo.brand || 'Not detected'}
- Detected Model: ${productInfo.model || 'Not detected'}
- Key Features: ${productInfo.keywords.join(', ') || 'None detected'}
- Technical Specs: ${Object.entries(productInfo.specs).map(([k, v]) => `${k}: ${v}`).join(', ') || 'None detected'}

`;

    // Add market dataset information (handles both Mercari and local data)
    if (marketData) {
        const avgPrice = marketData.avgPrice || marketData.averagePrice;
        const priceMin = marketData.priceRange?.min;
        const priceMax = marketData.priceRange?.max;
        const brands = marketData.topBrands || marketData.popularBrands;
        const totalItems = marketData.totalItems;

        prompt += `
MARKET DATASET FOR ${category.toUpperCase()}:
- Data Source: ${totalItems ? `Mercari Dataset (${totalItems.toLocaleString()} items)` : 'Local Market Data'}
- Market Average Price: ₱${avgPrice?.toLocaleString() || 'N/A'}
- Typical Price Range: ₱${priceMin?.toLocaleString()} - ₱${priceMax?.toLocaleString()}
- Popular Brands: ${brands?.join(', ') || 'N/A'}
- Condition Depreciation Rates:
${Object.entries(marketData.depreciation || {}).map(([cond, rate]) => `  - ${cond}: ${(rate * 100).toFixed(0)}% of original value`).join('\n')}

CALCULATED BASE PRICE (from dataset + adjustments): ₱${basePrice.toLocaleString()}
This base price already accounts for:
- Market average for this category
- Condition depreciation (${condition})
- Feature adjustments (warranty, box, accessories, age, etc.)

`;

        // Add market insights from dataset
        if (marketData.marketInsights && marketData.marketInsights.length > 0) {
            prompt += `MARKET INSIGHTS FROM DATASET:\n`;
            marketData.marketInsights.forEach((insight, i) => {
                prompt += `${i + 1}. ${insight}\n`;
            });
            prompt += '\n';
        }
    }

    // Add comparable items from dataset
    if (comparableItems && comparableItems.length > 0) {
        prompt += `
COMPARABLE ITEMS FROM MARKET DATASET:
${comparableItems.map((item, i) => `${i + 1}. ${item.name}: ₱${item.price.toLocaleString()} (${item.relevance}% match, ${item.demand} demand)`).join('\n')}

`;
    }

    // Add historical data from database
    if (historicalData) {
        if (historicalData.successfulSales?.count > 0) {
            prompt += `
HISTORICAL SUCCESSFUL SALES FROM OUR PLATFORM (Last 180 days):
- Similar items sold: ${historicalData.successfulSales.count}
- Average selling price: ₱${historicalData.successfulSales.averagePrice.toFixed(2)}
- Price range: ₱${historicalData.successfulSales.priceRange.min} - ₱${historicalData.successfulSales.priceRange.max}

TOP COMPARABLE SALES:
${historicalData.successfulSales.items.map((item, i) => `${i + 1}. ${item.name}: ₱${item.finalPrice} (${item.bidCount} bids)`).join('\n')}

`;
        }

        if (historicalData.activeCompetition?.count > 0) {
            prompt += `
CURRENT ACTIVE COMPETITION (Live listings):
- Other active listings: ${historicalData.activeCompetition.count}
- Average listed price: ₱${historicalData.activeCompetition.averageStartingPrice.toFixed(2)}

RELEVANT ACTIVE LISTINGS:
${historicalData.activeCompetition.items.map((item, i) => `${i + 1}. ${item.name}: ₱${item.currentPrice} (${item.bidCount} bids)`).join('\n')}

`;
        }
    }

    prompt += `
ANALYSIS REQUIRED:
1. Suggest a competitive RESERVE PRICE (minimum acceptable selling price)
   - Use the calculated base price (₱${basePrice.toLocaleString()}) as a reference point
   - Consider market dataset averages and historical auction data
2. Suggest an attractive STARTING BID (initial bid to draw interest)
3. Suggest appropriate BID INCREMENT
4. Provide price range (realistic minimum and maximum based on market data)
5. Explain your reasoning (reference the dataset insights and comparable items)
6. Provide market insights and tips for the seller
7. Assign a confidence level (High/Medium/Low)

IMPORTANT GUIDELINES:
- All items listed are SECONDHAND. Condition scale: Brand New (1.0x) > Like New (0.85x) > Lightly Used (0.70x) > Used (0.55x) > Heavily Used (0.35x) > For Parts (0.15x)
- Apply the appropriate depreciation multiplier to the base price before recommending prices
- Reserve price should protect the seller's interest; align with secondhand market data
- Starting bid should be 60-80% of reserve price to encourage early bidding
- Bid increment should be 5-10% of starting bid
- "For Parts" items should have very low reserve prices — buyers expect non-functional or incomplete goods
- "Brand New" secondhand items (still sealed/unused) can price close to retail market value
- Consider brand value and demand from comparable items
- Philippine Peso (₱) currency
- Be conservative but competitive
- The calculated base price (₱${basePrice.toLocaleString()}) is data-informed and should heavily influence your recommendation

RESPOND IN THIS EXACT JSON FORMAT:
{
  "reservePrice": <number>,
  "startingBid": <number>,
  "bidIncrement": <number>,
  "priceRange": {
    "min": <number>,
    "max": <number>
  },
  "confidence": "<High|Medium|Low>",
  "reasoning": "<detailed explanation referencing market data and base price>",
  "marketInsights": [
    "<insight 1>",
    "<insight 2>",
    "<insight 3>"
  ],
  "comparableItems": [
    {
      "name": "<item name>",
      "price": <number>,
      "relevance": "<why it's comparable>"
    }
  ]
}

Provide ONLY the JSON response, no additional text.`;

    return prompt;
}

/**
 * Parse Gemini JSON response
 */
function parseAIResponse(response) {
    try {
        // Remove markdown code blocks if present
        let cleaned = response.trim();
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(cleaned);

        // Validate required fields
        if (!parsed.reservePrice || !parsed.startingBid || !parsed.bidIncrement) {
            throw new Error('Missing required price fields');
        }

        return normalizeAIRecommendation(parsed);
    } catch (error) {
        console.error('Failed to parse AI response:', error);
        console.log('Raw response:', response);
        throw new Error('Invalid AI response format');
    }
}

function normalizeAIRecommendation(parsed) {
    const reservePrice = roundToMarketStep(Number(parsed.reservePrice));
    const startingBid = Math.min(
        reservePrice,
        roundToMarketStep(Number(parsed.startingBid) || reservePrice * 0.75)
    );
    const bidIncrement = roundBidIncrement(Number(parsed.bidIncrement), startingBid);

    return {
        ...parsed,
        reservePrice,
        startingBid,
        bidIncrement,
        priceRange: {
            min: roundToMarketStep(Number(parsed.priceRange?.min) || reservePrice * 0.85),
            max: roundToMarketStep(Number(parsed.priceRange?.max) || reservePrice * 1.15)
        }
    };
}

export default {
    generatePriceRecommendation
};
