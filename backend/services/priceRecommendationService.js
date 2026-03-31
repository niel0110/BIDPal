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

// Initialize ML and Gemini AI
initModel();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
            console.log('📦 Loading Mercari dataset (first time, this may take ~2 minutes)...');
            try {
                await loadMercariDataCache();
                mercariData = getMercariData();
                console.log('✅ Mercari dataset loaded successfully:', mercariData?.length, 'items');
            } catch (loadError) {
                console.error('❌ Failed to load Mercari dataset:', loadError);
                throw new Error('Mercari dataset could not be loaded: ' + loadError.message);
            }
        }

        if (!mercariData || mercariData.length === 0) {
            throw new Error('Mercari dataset not available. Please ensure the dataset is properly loaded.');
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

        // Call Gemini API
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const result = await model.generateContent(prompt);
        const response = result.response.text();

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
                comparableItems: comparableItems.map(item => ({
                    name: item.name,
                    price: item.price,
                    relevance: `${item.relevance}% match - ${item.demand} demand`
                }))
            }
        };

    } catch (error) {
        console.error('Price recommendation error:', error);
        return {
            success: false,
            error: error.message,
            message: 'Unable to generate price recommendation. Please ensure the Mercari dataset is loaded and the AI service is available.'
        };
    }
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
                bids:Bids (amount)
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
                ? Math.max(...a.bids.map(b => b.amount)) 
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
- Reserve price should protect seller's interest and align with market data
- Starting bid should be 60-80% of reserve price to encourage bidding
- Bid increment should be 5-10% of starting bid
- Consider condition depreciation rates from dataset
- Consider brand value and market demand from comparable items
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
