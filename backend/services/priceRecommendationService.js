import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../config/supabase.js';
import {
    extractProductInfo,
    getMarketData,
    calculateFeatureAdjustment,
    findComparableItems,
    getMarketInsights
} from './productAnalyzer.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

        // Get market data from verified dataset
        const marketData = getMarketData(productInfo.category);
        console.log('📈 Market data loaded for:', productInfo.category);

        // Fetch historical data from database
        const historicalData = await fetchHistoricalData(productInfo.category, productInfo.brand);

        // Get comparable items from dataset
        const comparableItems = findComparableItems(productInfo, productInfo.category);
        console.log('🔍 Found comparable items:', comparableItems.length);

        // Calculate base price from market data
        let basePrice = marketData?.averagePrice || 5000;

        // Apply condition depreciation
        if (marketData?.depreciation && condition) {
            basePrice = basePrice * (marketData.depreciation[condition] || 0.7);
        }

        // Apply feature adjustments
        basePrice = calculateFeatureAdjustment(productInfo, basePrice);
        console.log('💰 Calculated base price:', basePrice);

        // Build comprehensive prompt with dataset
        const prompt = buildPricePrompt(productData, historicalData, marketData, productInfo, comparableItems, basePrice);

        // Call Gemini API
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Parse the response
        const recommendation = parseGeminiResponse(response);

        // Get market insights from dataset
        const datasetInsights = getMarketInsights(productInfo.category, productInfo);

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
                marketInsights: [...(recommendation.marketInsights || []), ...datasetInsights].slice(0, 5),
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
            fallback: generateFallbackRecommendation(productData)
        };
    }
}

/**
 * Fetch historical auction data for similar products
 */
async function fetchHistoricalData(category, brand) {
    try {
        // Get completed auctions from the last 90 days
        const { data: auctions, error } = await supabase
            .from('auctions')
            .select(`
                auction_id,
                reserve_price,
                current_price,
                buy_now_price,
                status,
                end_time,
                products (
                    name,
                    category,
                    condition,
                    brand
                ),
                bids (count)
            `)
            .eq('status', 'completed')
            .gte('end_time', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
            .limit(50);

        if (error) throw error;

        // Filter for similar items
        const similar = auctions?.filter(a => {
            const product = a.products;
            return product?.category === category || product?.brand === brand;
        }) || [];

        return {
            totalAuctions: similar.length,
            averagePrice: similar.length > 0
                ? similar.reduce((sum, a) => sum + (a.current_price || a.reserve_price), 0) / similar.length
                : 0,
            priceRange: {
                min: Math.min(...similar.map(a => a.current_price || a.reserve_price)),
                max: Math.max(...similar.map(a => a.current_price || a.reserve_price))
            },
            averageBidCount: similar.length > 0
                ? similar.reduce((sum, a) => sum + (a.bids?.[0]?.count || 0), 0) / similar.length
                : 0,
            topItems: similar.slice(0, 5).map(a => ({
                name: a.products?.name,
                finalPrice: a.current_price || a.reserve_price,
                bidCount: a.bids?.[0]?.count || 0
            }))
        };
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return null;
    }
}

/**
 * Build comprehensive prompt for Gemini
 */
function buildPricePrompt(productData, historicalData, marketData, productInfo, comparableItems, basePrice) {
    const { name, description, category, condition, brand, specifications } = productData;

    let prompt = `You are an expert auction pricing analyst. Analyze the following product and provide a detailed price recommendation for an online auction.

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

    // Add market dataset information
    if (marketData) {
        prompt += `
VERIFIED MARKET DATASET FOR ${category.toUpperCase()}:
- Market Average Price: ₱${marketData.averagePrice?.toLocaleString() || 'N/A'}
- Typical Price Range: ₱${marketData.priceRange?.min?.toLocaleString()} - ₱${marketData.priceRange?.max?.toLocaleString()}
- Popular Brands: ${marketData.popularBrands?.join(', ') || 'N/A'}
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
    if (historicalData && historicalData.totalAuctions > 0) {
        prompt += `
HISTORICAL AUCTION DATA FROM OUR PLATFORM (Last 90 days):
- Similar items sold: ${historicalData.totalAuctions}
- Average selling price: ₱${historicalData.averagePrice.toFixed(2)}
- Price range: ₱${historicalData.priceRange.min} - ₱${historicalData.priceRange.max}
- Average bid count: ${historicalData.averageBidCount.toFixed(1)}

TOP COMPARABLE SALES:
${historicalData.topItems.map((item, i) => `${i + 1}. ${item.name}: ₱${item.finalPrice} (${item.bidCount} bids)`).join('\n')}

`;
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

/**
 * Generate fallback recommendation when AI fails
 */
function generateFallbackRecommendation(productData) {
    try {
        // Try to use market dataset for fallback
        const productInfo = extractProductInfo(productData);
        const marketData = getMarketData(productInfo.category);

        let basePrice = 5000; // Default fallback

        if (marketData && marketData.averagePrice) {
            // Use market dataset if available
            basePrice = marketData.averagePrice;

            // Apply condition depreciation from dataset
            if (marketData.depreciation && productData.condition) {
                basePrice = basePrice * (marketData.depreciation[productData.condition] || 0.7);
            }

            // Apply feature adjustments
            basePrice = calculateFeatureAdjustment(productInfo, basePrice);
        } else {
            // Old fallback logic if dataset not available
            const categoryMultipliers = {
                'Smartphones': 15000,
                'Laptops': 35000,
                'Smartwatches': 8000,
                'Tablets': 20000,
                'Electronics': 10000,
                'Fashion': 2000,
                'Home & Garden': 5000,
                'Sports': 8000,
                'Collectibles': 5000
            };

            const conditionMultipliers = {
                'New': 1.0,
                'Like New': 0.85,
                'Good': 0.70,
                'Fair': 0.50,
                'Poor': 0.30
            };

            basePrice = categoryMultipliers[productData.category] || 5000;
            basePrice = Math.round(basePrice * (conditionMultipliers[productData.condition] || 0.7));
        }

        const reservePrice = Math.round(basePrice);
        const startingBid = Math.round(reservePrice * 0.7);
        const bidIncrement = Math.round(startingBid * 0.08);

        return {
            suggestedReservePrice: reservePrice,
            suggestedStartingBid: startingBid,
            suggestedBidIncrement: bidIncrement,
            priceRange: {
                min: Math.round(reservePrice * 0.8),
                max: Math.round(reservePrice * 1.5)
            },
            confidence: 'Medium',
            reasoning: marketData
                ? `Price based on market dataset for ${productInfo.category}. Average market price: ₱${marketData.averagePrice?.toLocaleString()}, adjusted for ${productData.condition} condition and detected features.`
                : 'This is a basic estimate. For more accurate pricing, please try again or consult market research.',
            marketInsights: marketData?.marketInsights || [
                'Consider researching similar items on other platforms',
                'High-quality photos can increase final price by 20-30%',
                'Detailed descriptions attract more serious bidders'
            ],
            comparableItems: []
        };
    } catch (error) {
        console.error('Fallback recommendation error:', error);
        // Ultimate fallback if everything fails
        return {
            suggestedReservePrice: 5000,
            suggestedStartingBid: 3500,
            suggestedBidIncrement: 300,
            priceRange: { min: 4000, max: 7500 },
            confidence: 'Low',
            reasoning: 'Basic estimate due to system error. Please consult market research.',
            marketInsights: ['Consider researching similar items on other platforms'],
            comparableItems: []
        };
    }
}

export default {
    generatePriceRecommendation
};
