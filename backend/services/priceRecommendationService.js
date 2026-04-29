import { GoogleGenerativeAI } from '@google/generative-ai';
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

// NOTE: Mercari data auto-loading disabled for faster startup
// The dataset (1.4M products) takes ~2 minutes to load
// It will be loaded on-demand when first price recommendation is requested
// To enable auto-loading, uncomment below:
/*
loadMercariDataCache().then(() => {
    console.log('✅ Mercari dataset loaded and ready');
}).catch(err => {
    console.log('⚠️ Mercari dataset not available:', err.message);
});
*/
console.log('💡 Mercari dataset will load on-demand (first request will take ~2 min)');

/**
 * Generate price recommendation using Gemini AI
 * @param {Object} productData - Product information
 * @returns {Object} Price recommendation with insights
 */
export async function generatePriceRecommendation(productData) {
    try {
        // Extract detailed product information
        const productInfo = extractProductInfo(productData);
        console.log('📊 Extracted product info:', productInfo);

        // Use Mercari dataset exclusively
        let mercariData = getMercariData();

        // Load on-demand if not already loaded
        if (!mercariData || mercariData.length === 0) {
            console.log('📦 Loading Mercari dataset...');
            try {
                await loadMercariDataCache();
                mercariData = getMercariData();
                console.log('✅ Mercari dataset loaded:', mercariData?.length, 'items');
            } catch (loadError) {
                console.warn('⚠️ Mercari dataset unavailable, using Gemini-only recommendation');
            }
        }

        // Fall back to Gemini-only if Mercari data is still unavailable
        if (!mercariData || mercariData.length === 0) {
            return generateGeminiOnlyRecommendation(productData, productInfo);
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
        let basePrice;
        if (marketData && marketData.avgPrice) {
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

        // Fetch historical data from database
        const historicalData = await fetchHistoricalData(productInfo.category, productInfo.brand);

        // Apply feature adjustments
        basePrice = calculateFeatureAdjustment(productInfo, basePrice);
        console.log('💰 Calculated base price:', basePrice);

        // Build comprehensive prompt with dataset
        const mlPriceEstimate = predictPrice(productInfo);
        const prompt = buildPricePrompt(productData, historicalData, marketData, productInfo, comparableItems, basePrice, mlPriceEstimate);

        // Call Gemini API with multiple models and retries
        let response;
        try {
            response = await callGeminiWithRetry(prompt);
        } catch (geminiError) {
            console.warn('⚠️ Gemini AI failed with all models:', geminiError.message);
            throw geminiError; // Trigger heuristic fallback in the main catch block
        }

        // Parse the response
        const recommendation = parseGeminiResponse(response);

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

        // FALLBACK: Use heuristic recommendation if Gemini fails (especially for 429 quota errors)
        try {
            console.log('⚠️ AI Service failed, attempting heuristic fallback...');
            const productInfo = extractProductInfo(productData);
            const mercariData = getMercariData();
            
            if (mercariData && mercariData.length > 0) {
                const comparableItems = findMercariComparables(mercariData, productInfo, 10);
                const marketData = getMercariMarketStats(mercariData, productInfo.category, productInfo.brand);
                const mlPriceEstimate = predictPrice(productInfo);
                
                let basePrice = 5000;
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
                
                return generateHeuristicRecommendation(productInfo, comparableItems, basePrice, error.message, !!mlPriceEstimate);
            }
        } catch (fallbackError) {
            console.error('Fallback recommendation failed:', fallbackError);
        }

        return {
            success: false,
            error: error.message,
            message: 'Unable to generate price recommendation. Please ensure the Mercari dataset is loaded and the AI service is available.'
        };
    }
}

/**
 * Generate a data-driven recommendation without AI when Gemini is unavailable
 */
function generateHeuristicRecommendation(productInfo, comparableItems, basePrice, originalError, usedML = false) {
    const isQuotaError = originalError?.includes('429') || originalError?.includes('quota');
    
    // Calculate prices based on basePrice from market data
    const reservePrice = Math.round(basePrice);
    const startingBid = Math.round(reservePrice * 0.75);
    const bidIncrement = Math.round(startingBid * 0.05 / 10) * 10; // Round to nearest 10
    
    const mlMethod = usedML ? "Random Forest Predictive Model" : "Market Data Analysis";
    
    return {
        success: true,
        recommendation: {
            suggestedReservePrice: reservePrice,
            suggestedStartingBid: startingBid,
            suggestedBidIncrement: bidIncrement,
            priceRange: {
                min: Math.round(reservePrice * 0.85),
                max: Math.round(reservePrice * 1.15)
            },
            confidence: usedML ? "High" : "Medium",
            reasoning: usedML 
                ? `Our dynamic Random Forest ML model analyzed market trends for "${productInfo.name}" and predicted an optimal price of ₱${basePrice.toLocaleString()}. This model factors in category demand, brand value, and item condition across 1.4M data points.`
                : `Market-driven recommendation based on ${comparableItems.length} similar items found in our dataset for "${productInfo.category}". The average price for these items is ₱${basePrice.toLocaleString()}.`,
            marketInsights: [
                usedML ? "Utilizing Random Forest regression for multi-factor price prediction." : "Based on comparable listings in the category.",
                `Analyzed ${comparableItems.length} recent similar listings for ${productInfo.brand || 'market'} accuracy.`,
                "Condition-weighted pricing adjustment applied automatically.",
                "Starting bid optimized at 75% of market value to drive auction engagement."
            ],
            comparableItems: comparableItems.slice(0, 5).map(item => ({
                name: item.name,
                price: item.price,
                relevance: `${item.relevance}% match`
            })),
            warning: isQuotaError 
                ? `AI service is currently at capacity. Switched to ${mlMethod} for a precise recommendation.` 
                : `AI service unavailable. Providing recommendation based on ${mlMethod}.`,
            isML: usedML
        }
    };
}

/**
 * Fetch historical auction data for similar products
 */
async function fetchHistoricalData(category, brand) {
    try {
        // Get both ended and active auctions from the last 90 days
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
            .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
            .limit(100);

        if (error) throw error;

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

        const successfulSales = processedAuctions.filter(a => a.status === 'ended' && (a.final_price > 0));
        const activeListings = processedAuctions.filter(a => a.status === 'active');

        return {
            totalAuctions: similar.length,
            successfulSales: {
                count: successfulSales.length,
                averagePrice: successfulSales.length > 0
                    ? successfulSales.reduce((sum, a) => sum + a.final_price, 0) / successfulSales.length
                    : 0,
                priceRange: successfulSales.length > 0 ? {
                    min: Math.min(...successfulSales.map(a => a.final_price)),
                    max: Math.max(...successfulSales.map(a => a.final_price))
                } : null,
                items: successfulSales.slice(0, 10).map(a => ({
                    name: a.products?.name,
                    finalPrice: a.final_price,
                    bidCount: a.bid_count
                }))
            },
            activeCompetition: {
                count: activeListings.length,
                averageStartingPrice: activeListings.length > 0
                    ? activeListings.reduce((sum, a) => sum + (a.reserve_price || a.buy_now_price), 0) / activeListings.length
                    : 0,
                items: activeListings.slice(0, 5).map(a => ({
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
 * Gemini-only fallback when Mercari dataset is unavailable
 */
async function generateGeminiOnlyRecommendation(productData, productInfo) {
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
        const response = await callGeminiWithRetry(prompt);
        const recommendation = parseGeminiResponse(response);
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
        return { success: false, error: err.message, message: 'AI service unavailable. Please try again.' };
    }
}

/**
 * Call Gemini API with multiple models and exponential backoff retry
 */
async function callGeminiWithRetry(prompt, maxRetries = 2) {
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'];
    let lastError;

    // Create genAI here so it reads the key after dotenv.config() has run
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    for (const modelName of models) {
        console.log(`🤖 Attempting recommendation with model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });

        for (let i = 0; i <= maxRetries; i++) {
            try {
                const result = await model.generateContent(prompt);
                return result.response.text();
            } catch (error) {
                lastError = error;
                const isQuotaError = error.message?.includes('429') || error.message?.includes('quota');
                
                if (isQuotaError) {
                    console.warn(`⚠️ Quota exceeded for ${modelName} (Attempt ${i + 1}/${maxRetries + 1})`);
                    if (i < maxRetries) {
                        const delay = Math.pow(2, i) * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    // If out of retries for this model, try the next model
                    break; 
                } else {
                    // Non-quota error, try next model immediately or throw
                    console.error(`❌ Error with ${modelName}:`, error.message);
                    break;
                }
            }
        }
    }

    throw lastError;
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
HISTORICAL SUCCESSFUL SALES FROM OUR PLATFORM (Last 90 days):
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
 * Parse Gemini's JSON response
 */
function parseGeminiResponse(response) {
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

        return parsed;
    } catch (error) {
        console.error('Failed to parse Gemini response:', error);
        console.log('Raw response:', response);
        throw new Error('Invalid AI response format');
    }
}

export default {
    generatePriceRecommendation
};
