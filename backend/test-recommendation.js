import dotenv from 'dotenv';
dotenv.config();
import { generatePriceRecommendation } from './services/priceRecommendationService.js';

const testProduct = {
    name: 'iPhone 13 Pro',
    description: '128GB, Sierra Blue, Excellent condition, with original box and cable.',
    category: 'Smartphones',
    condition: 'Like New',
    brand: 'Apple',
    specifications: '128GB storage, 6.1-inch OLED display'
};

async function runTest() {
    console.log('🚀 Starting price recommendation test with NEW KEY...');
    try {
        const result = await generatePriceRecommendation(testProduct);
        if (result.success) {
            console.log('✅ Recommendation generated successfully!');
            console.log(JSON.stringify(result.recommendation, null, 2));
        } else {
            console.error('❌ Recommendation failed:', result.error);
            if (result.fallback) {
                console.log('⚠️ Fallback used:', JSON.stringify(result.fallback, null, 2));
            }
        }
    } catch (error) {
        console.error('💥 Unexpected error during test:', error);
    }
}

runTest();
