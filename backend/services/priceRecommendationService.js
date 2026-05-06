import { supabase } from '../config/supabase.js';
import {
    extractProductInfo,
    calculateFeatureAdjustment,
    getPHFormulaBreakdown
} from './productAnalyzer.js';
import {
    initModel,
    predictPrice,
    loadMercariDataCache,
    getMercariData
} from './mlModelService.js';
import {
    getMercariMarketStats,
    findMercariComparables,
    getMercariMarketStatsFromIndex,
    findMercariComparablesFromIndex,
    loadMercariIndex,
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

        // ── Step 1: PH SRP from Gemini (primary anchor) ──────────────────────
        const srpResult = await fetchPHSRP(productInfo, productData)
            || estimateLocalPHSRP(productInfo, productData);

        // ── Step 2: Apply PH formula to SRP ───────────────────────────────────
        let basePrice;
        let formulaBreakdown = null;

        if (srpResult?.srp > 0) {
            formulaBreakdown = getPHFormulaBreakdown(srpResult.srp, productInfo);
            basePrice = capBasePriceByRetailAnchor(
                roundToMarketStep(formulaBreakdown.result),
                srpResult.srp,
                productInfo.condition
            );
            console.log('🇵🇭 PH formula base price:', basePrice, formulaBreakdown);
        }

        // ── Step 3: Mercari + ML as sanity check / fallback ───────────────────
        let mercariData = getMercariData();
        const mlPriceEstimate = predictPrice(productInfo);
        if (!mercariData || mercariData.length === 0) {
            mercariData = await waitForMercariData();
        }
        ensureMercariLoaded();

        const mercariData_ = mercariData || [];
        const hasFullDataset = mercariData_.length > 0;

        // Use full in-memory dataset when available; fall back to precomputed index
        const marketData = hasFullDataset
            ? getMercariMarketStats(mercariData_, productInfo.category, productInfo.brand)
            : getMercariMarketStatsFromIndex(productInfo.category, productInfo.brand);
        const comparableItems = hasFullDataset
            ? findMercariComparables(mercariData_, productInfo, 10)
            : findMercariComparablesFromIndex(productInfo, 10);

        if (!hasFullDataset && loadMercariIndex()) {
            console.log('📊 Using precomputed Mercari market index (production mode)');
        }

        if (!basePrice) {
            const mercariBase = calculateDataDrivenBasePrice(productInfo, comparableItems, marketData, mlPriceEstimate);
            basePrice = roundToMarketStep(calculateFeatureAdjustment(productInfo, mercariBase));
            if (srpResult?.srp > 0) {
                basePrice = capBasePriceByRetailAnchor(basePrice, srpResult.srp, productInfo.condition);
            }
            console.log('📦 Mercari fallback base price:', basePrice);
        } else if (comparableItems.length >= 3) {
            // Sanity-check: blend if formula and Mercari diverge strongly (>2.5x gap)
            const mercariMedian = comparableItems.slice(0, 5)
                .reduce((s, i) => s + i.price, 0) / Math.min(5, comparableItems.length);
            const ratio = basePrice / mercariMedian;
            if (ratio > 2.5 || ratio < 0.4) {
                console.warn(`⚠️ Formula ₱${basePrice.toLocaleString()} vs Mercari ₱${Math.round(mercariMedian).toLocaleString()} — blending.`);
                basePrice = roundToMarketStep(basePrice * 0.80 + mercariMedian * 0.20);
            }
        }

        // ── Step 4: Blend with BIDPal historical sales ────────────────────────
        const historicalData = await fetchHistoricalData(productInfo.category, productInfo.brand);
        basePrice = blendWithHistoricalSales(basePrice, historicalData);
        if (srpResult?.srp > 0) {
            basePrice = capBasePriceByRetailAnchor(basePrice, srpResult.srp, productInfo.condition);
        }
        console.log('💰 Final base price:', basePrice);

        // Build prompt — Gemini frames auction params around the formula-derived price
        const prompt = buildPricePrompt(productData, historicalData, marketData, productInfo, comparableItems, basePrice, mlPriceEstimate, formulaBreakdown, srpResult);

        if (!isGeminiEnabled()) {
            console.log('Deterministic recommendation mode enabled; skipping Gemini refinement');
            return generateHeuristicRecommendation(
                productInfo, comparableItems, basePrice,
                'Gemini disabled by configuration',
                !!formulaBreakdown || comparableItems.length >= 3
            );
        }

        if (isGeminiCoolingDown()) {
            console.log('Gemini quota cooldown active; using deterministic recommendation');
            return generateHeuristicRecommendation(
                productInfo, comparableItems, basePrice,
                'Gemini cooldown active',
                !!formulaBreakdown || comparableItems.length >= 3
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
                !!formulaBreakdown || comparableItems.length >= 3
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

        // FALLBACK: heuristic recommendation when the main flow throws
        try {
            console.log('⚠️ AI Service failed, attempting heuristic fallback...');
            const productInfo = extractProductInfo(productData);
            const mercariData = getMercariData();
            const mlPriceEstimate = predictPrice(productInfo);
            const comparableItems = mercariData?.length
                ? findMercariComparables(mercariData, productInfo, 10) : [];
            const marketData = mercariData?.length
                ? getMercariMarketStats(mercariData, productInfo.category, productInfo.brand) : null;

            let basePrice = calculateDataDrivenBasePrice(productInfo, comparableItems, marketData, mlPriceEstimate);
            console.log('Using deterministic fallback base:', basePrice);
            return generateHeuristicRecommendation(productInfo, comparableItems, basePrice, error.message, comparableItems.length >= 3);
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

const SECONDHAND_SRP_CAPS = {
    'Brand New': 0.95,
    'Like New': 0.82,
    'Lightly Used': 0.72,
    'Used': 0.60,
    'Heavily Used': 0.38,
    'For Parts': 0.18,
};

function capBasePriceByRetailAnchor(basePrice, srp, condition) {
    if (!Number.isFinite(basePrice) || !Number.isFinite(srp) || basePrice <= 0 || srp <= 0) {
        return basePrice;
    }

    const maxShare = SECONDHAND_SRP_CAPS[condition] ?? 0.60;
    const capped = Math.min(basePrice, srp * maxShare);
    return roundToMarketStep(capped);
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

    const maxReasonable = basePrice * 1.60;
    const minReasonable = basePrice * 0.50;
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
 * When strong pricing signals are available (PH SRP anchor, RF, or ML), the
 * result is high quality and shown without a warning banner.
 */
function generateHeuristicRecommendation(productInfo, comparableItems, basePrice, originalError, hasStrongPricingSignals = false) {
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
        confidence: hasStrongPricingSignals ? 'High' : 'Medium',
        reasoning: hasStrongPricingSignals
            ? `The pricing engine used strong pricing signals for "${productInfo.name || productInfo.category}", including PH retail anchors when available, product specifications, condition, brand value, and market data. Recommended reserve price: PHP ${reservePrice.toLocaleString()}.`
            : `Market-driven recommendation based on ${comparableItems.length} similar listings in the "${productInfo.category}" category. Average comparable price: ₱${basePrice.toLocaleString()}.`,
        marketInsights: [
            hasStrongPricingSignals
                ? 'PH retail anchors, model signals, product specs, and available market history were blended.'
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
        isML: hasStrongPricingSignals
    };

    // Only show a warning for non-ML fallback (quota/unavailable) — not for ML results
    if (!hasStrongPricingSignals) {
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
    if (process.env.PRICE_RECOMMENDATION_SKIP_HISTORY === 'true') {
        return null;
    }

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
 * Offline PH SRP anchors for high-volume products where Gemini outages should not
 * force the recommendation engine back to old cross-market averages.
 */
function estimateLocalPHSRP(productInfo, productData) {
    const brand = (productData.brand || productInfo.brand || '').toLowerCase();
    const text = `${productData.name || productInfo.name || ''} ${productData.specifications || ''} ${productInfo.description || ''}`.toLowerCase();

    const luxuryAnchor = estimateLuxuryRetailAnchor(brand, text, productInfo, productData);
    if (luxuryAnchor) return luxuryAnchor;

    if (brand !== 'apple' && !text.includes('iphone')) return null;

    const storageMatch = text.match(/\b(128|256|512)\s*gb\b|\b(1)\s*tb\b/i);
    const storage = storageMatch
        ? (storageMatch[1] ? `${storageMatch[1]}GB` : '1TB')
        : (productInfo.specs?.storage || '').toUpperCase();

    const iphoneSrp = [
        { pattern: /\biphone\s*15\s*pro\s*max\b/, prices: { '256GB': 84990, '512GB': 96990, '1TB': 108990 } },
        { pattern: /\biphone\s*15\s*pro\b/, prices: { '128GB': 70990, '256GB': 77990, '512GB': 89990, '1TB': 101990 } },
        { pattern: /\biphone\s*15\s*plus\b/, prices: { '128GB': 63990, '256GB': 70990, '512GB': 82990 } },
        { pattern: /\biphone\s*15\b/, prices: { '128GB': 56990, '256GB': 63990, '512GB': 75990 } },
        { pattern: /\biphone\s*14\s*pro\s*max\b/, prices: { '128GB': 77990, '256GB': 84990, '512GB': 96990, '1TB': 108990 } },
        { pattern: /\biphone\s*14\s*pro\b/, prices: { '128GB': 70990, '256GB': 77990, '512GB': 89990, '1TB': 101990 } },
        { pattern: /\biphone\s*14\s*plus\b/, prices: { '128GB': 63990, '256GB': 70990, '512GB': 82990 } },
        { pattern: /\biphone\s*14\b/, prices: { '128GB': 56990, '256GB': 63990, '512GB': 75990 } },
        { pattern: /\biphone\s*13\s*pro\s*max\b/, prices: { '128GB': 70990, '256GB': 76990, '512GB': 88990, '1TB': 101990 } },
        { pattern: /\biphone\s*13\s*pro\b/, prices: { '128GB': 63990, '256GB': 70990, '512GB': 82990, '1TB': 95990 } },
        { pattern: /\biphone\s*13\b/, prices: { '128GB': 50990, '256GB': 57990, '512GB': 69990 } },
    ];

    const match = iphoneSrp.find(entry => entry.pattern.test(text));
    const srp = match?.prices?.[storage] || (match ? Object.values(match.prices)[0] : 0);
    if (!srp) return null;

    console.log(`Local PH SRP anchor: PHP ${srp.toLocaleString()} (${storage || 'base storage'})`);
    return {
        srp,
        confidence: 'Medium',
        note: `Local PH SRP anchor for ${productData.name || productInfo.name || 'Apple iPhone'}`
    };
}

function estimateLuxuryRetailAnchor(brand, text, productInfo, productData) {
    if (brand !== 'chanel' && !text.includes('chanel')) return null;

    const usdToPhp = Number(process.env.LUXURY_USD_TO_PHP || 58.5);
    const chanelBags = [
        { pattern: /\bclassic\s+flap\b.*\bmedium\b|\bmedium\b.*\bclassic\s+flap\b|\bm\/l\b.*\bclassic\s+flap\b/, usd: 11700, label: 'Chanel Classic Flap Medium' },
        { pattern: /\bclassic\s+flap\b.*\bsmall\b|\bsmall\b.*\bclassic\s+flap\b/, usd: 11300, label: 'Chanel Classic Flap Small' },
        { pattern: /\bclassic\s+flap\b.*\bjumbo\b|\bjumbo\b.*\bclassic\s+flap\b/, usd: 12600, label: 'Chanel Classic Flap Jumbo' },
        { pattern: /\bclassic\s+flap\b.*\bmaxi\b|\bmaxi\b.*\bclassic\s+flap\b/, usd: 13200, label: 'Chanel Classic Flap Maxi' },
        { pattern: /\bclassic\s+flap\b.*\bmini\b|\bmini\b.*\bclassic\s+flap\b/, usd: 5600, label: 'Chanel Classic Flap Mini' },
        { pattern: /\bboy\s+bag\b.*\bmedium\b|\bmedium\b.*\bboy\s+bag\b/, usd: 7400, label: 'Chanel Boy Bag Medium' },
        { pattern: /\bwallet\s+on\s+chain\b|\bwoc\b/, usd: 3350, label: 'Chanel Wallet on Chain' },
    ];

    const match = chanelBags.find(entry => entry.pattern.test(text));
    if (!match) return null;

    const srp = roundToMarketStep(match.usd * usdToPhp);
    console.log(`Local luxury retail anchor: PHP ${srp.toLocaleString()} (${match.label})`);
    return {
        srp,
        confidence: 'Medium',
        note: `Local 2026 retail anchor for ${match.label} based on current US luxury price guides`
    };
}

/**
 * Ask Gemini for the current Philippine SRP (brand-new retail price) of a product.
 * Returns the SRP in PHP, or null if unavailable.
 */
async function fetchPHSRP(productInfo, productData) {
    if (!isGeminiEnabled() || isGeminiCoolingDown()) return null;

    const specs = Object.entries(productInfo.specs || {})
        .map(([k, v]) => `${k}: ${v}`).join(', ') || 'not specified';

    const prompt = `You are a Philippine retail price reference database.

Return the current Philippine SRP (Suggested Retail Price) in PHP for a BRAND NEW unit of this exact product.

Product: ${productData.name || productInfo.name}
Brand: ${productData.brand || productInfo.brand || 'Unknown'}
Category: ${productData.category || productInfo.category}
Specs: ${productData.specifications || specs}

Rules:
- Use the actual current price from authorized PH retailers (Lazada, Shopee, brand stores)
- If the exact model is unknown, estimate based on brand tier and specs
- phSRP must be in Philippine Peso (PHP), a positive number
- confidence: "High" if you know the exact model price, "Medium" if estimated, "Low" if guessed

Respond with JSON only:
{
  "phSRP": <number>,
  "confidence": "High|Medium|Low",
  "note": "<specific model or reference used>"
}`;

    try {
        const raw = await callGeminiWithRetry(prompt, { jsonMode: true, thinking: true, timeoutMs: 25000 });
        const parsed = parseJSONResponse(raw);
        if (parsed.phSRP > 0) {
            console.log(`💡 PH SRP: ₱${parsed.phSRP.toLocaleString()} (${parsed.confidence}) — ${parsed.note}`);
            return { srp: parsed.phSRP, confidence: parsed.confidence, note: parsed.note };
        }
    } catch (err) {
        console.warn('⚠️ PH SRP fetch failed:', err.message);
    }
    return null;
}

async function callAIWithRetry(prompt) {
    if (isGeminiCoolingDown()) throw new Error('Gemini quota cooldown active');
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
    return callGeminiWithRetry(prompt, { jsonMode: true, timeoutMs: 30000 });
}

/**
 * Call Gemini REST API directly.
 * opts.jsonMode  — request application/json response (structured output, no markdown wrapping)
 * opts.thinking  — enable thinking budget for deeper reasoning (SRP lookups)
 * opts.timeoutMs — per-request timeout in ms (default 20000)
 */
async function callGeminiWithRetry(prompt, opts = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

    const { jsonMode = false, thinking = false, timeoutMs = 20000 } = opts;

    const configuredModel = process.env.GEMINI_PRICE_MODEL;
    const candidates = configuredModel ? [[configuredModel, 'v1beta']] : [
        ['gemini-2.5-flash', 'v1beta'],
        ['gemini-2.0-flash', 'v1beta'],
        ['gemini-2.0-flash', 'v1'],
    ];

    let lastError;
    for (const [model, apiVersion] of candidates) {
        const supportsBetaGenerationOptions = apiVersion === 'v1beta';
        const generationConfig = {
            temperature: 0.2,
            maxOutputTokens: 2048,
            ...(jsonMode && supportsBetaGenerationOptions && { responseMimeType: 'application/json' }),
            ...(thinking && supportsBetaGenerationOptions && { thinkingConfig: { thinkingBudget: 1024 } }),
        };
        const body = JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig,
        });
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
        console.log(`🤖 Trying ${model} (${apiVersion})${jsonMode && supportsBetaGenerationOptions ? ' [JSON mode]' : ''}${thinking && supportsBetaGenerationOptions ? ' [thinking]' : ''}...`);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
                const errBody = await res.json().catch(() => ({}));
                console.warn(`⚠️  ${model} quota hit: ${errBody?.error?.message?.slice(0, 80) || '429'}`);
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
                console.warn(`⚠️  ${model} timed out after ${timeoutMs}ms`);
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
function buildPricePrompt(productData, historicalData, marketData, productInfo, comparableItems, basePrice, mlPriceEstimate, formulaBreakdown = null, srpResult = null) {
    const { name, description, category, condition, brand, specifications } = productData;

    let formulaSection = '';
    if (formulaBreakdown) {
        formulaSection = `
PH SECONDHAND PRICE FORMULA (primary anchor):
- PH Retail SRP (brand new): ₱${formulaBreakdown.srp.toLocaleString()} — ${srpResult?.note || ''}
- Condition factor (${condition}): ×${formulaBreakdown.condition}
- Age depreciation: ×${formulaBreakdown.age}
- Brand premium (${productInfo.brand || 'unbranded'}): ×${formulaBreakdown.brand}
- PH category demand: ×${formulaBreakdown.demand}
- Spec multiplier: ×${formulaBreakdown.spec.toFixed(2)}
- Formula result: ₱${formulaBreakdown.result.toLocaleString()}
- Final base price (after historical blend): ₱${basePrice.toLocaleString()}

`;
    }

    let prompt = `You are an expert auction pricing analyst for BIDPal, a Philippine online auction platform. Use the data below to recommend auction prices in Philippine Peso.

PRODUCT DETAILS:
- Name: ${name}
- Category: ${category}
- Condition: ${condition}
- Brand: ${brand || productInfo.brand || 'Not specified'}
- Description: ${description}
- Specifications: ${specifications || 'Not specified'}
- Detected Model: ${productInfo.model || 'Not detected'}
- Key Features: ${productInfo.keywords.join(', ') || 'None detected'}
- Technical Specs: ${Object.entries(productInfo.specs).map(([k, v]) => `${k}: ${v}`).join(', ') || 'None detected'}

${formulaSection}RANDOM FOREST ML ESTIMATE: ₱${mlPriceEstimate?.toLocaleString() || 'N/A'}

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
TASK:
The computed secondhand price using the PH formula is ₱${basePrice.toLocaleString()}.
${formulaBreakdown ? 'This already factors in PH retail SRP, condition, age, brand premium, category demand, and specs. Treat it as the reserve price anchor.' : 'Use this as the reserve price reference point.'}

1. Set RESERVE PRICE close to ₱${basePrice.toLocaleString()} — adjust only if historical or comparable data strongly suggests otherwise (max ±15%)
2. Set STARTING BID at 70-80% of reserve to attract early bids
3. Set BID INCREMENT at 5% of starting bid, rounded to nearest ₱50/₱100/₱500 depending on price tier
4. Set PRICE RANGE: min = reserve × 0.85, max = reserve × 1.20
5. Write REASONING that explains the formula inputs and market context
6. List 3 MARKET INSIGHTS relevant to selling this item in the Philippine market
7. Set CONFIDENCE: High if SRP was confirmed, Medium if estimated, Low if guessed

GUIDELINES:
- Philippine Peso (₱) — all amounts must reflect PH secondhand market reality
- Starting bid 60-80% of reserve to maximise early bidding engagement
- For Parts items: reserve ≤ 15% of SRP regardless of formula output
- Do NOT re-apply condition depreciation — the formula already did it
- Bid increment tiers: <₱3,000 → ₱50-100 | ₱3,000-10,000 → ₱100-500 | ₱10,000-50,000 → ₱500-1,000 | >₱50,000 → ₱1,000-2,000

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
 * Parse Gemini JSON response.
 * With JSON mode enabled the response is already clean JSON; the markdown
 * stripping is kept as a safety net for any legacy non-JSON-mode paths.
 */
function parseAIResponse(response) {
    try {
        const parsed = parseJSONResponse(response);

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

function parseJSONResponse(response) {
    const cleaned = response.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '');

    return JSON.parse(cleaned);
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
