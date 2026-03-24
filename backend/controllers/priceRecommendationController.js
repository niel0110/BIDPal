import { generatePriceRecommendation } from '../services/priceRecommendationService.js';

/**
 * POST /api/price-recommendation
 * Get AI-powered price recommendation for a product
 */
export const getPriceRecommendation = async (req, res) => {
    try {
        const productData = req.body;

        // Validate required fields
        if (!productData.name || !productData.category) {
            return res.status(400).json({
                error: 'Product name and category are required'
            });
        }

        console.log('Generating price recommendation for:', productData.name);

        const result = await generatePriceRecommendation(productData);

        if (result.success) {
            return res.json({
                success: true,
                ...result.recommendation
            });
        } else {
            // Return fallback recommendation with error info
            return res.json({
                success: true,
                ...result.fallback,
                warning: 'AI service unavailable, showing basic estimate',
                errorDetails: result.error
            });
        }

    } catch (error) {
        console.error('Price recommendation controller error:', error);
        return res.status(500).json({
            error: 'Failed to generate price recommendation',
            details: error.message
        });
    }
};

export default {
    getPriceRecommendation
};
