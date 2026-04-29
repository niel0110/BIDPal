import dotenv from 'dotenv';
dotenv.config();
import { trainWithMercariData } from './services/mlModelService.js';

async function runTraining() {
    console.log('🏗️ Starting Random Forest training with Mercari dataset...');
    const startTime = Date.now();
    
    try {
        // Train with 1,000 samples for a good balance of speed and accuracy
        const success = await trainWithMercariData(1000);
        
        if (success) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`✅ Training completed successfully in ${duration}s!`);
            console.log('🚀 Random Forest model is now ready for dynamic predictions.');
        } else {
            console.error('❌ Training failed. Please check the logs.');
        }
    } catch (err) {
        console.error('💥 Training crashed:', err.message);
    }
}

runTraining();
