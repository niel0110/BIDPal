import { trainWithMercariData } from '../services/mlModelService.js';

/**
 * Script to train the ML model using Mercari dataset
 *
 * Usage:
 * node scripts/trainMercariModel.js [maxSamples]
 *
 * Example:
 * node scripts/trainMercariModel.js 50000
 */

async function main() {
    console.log('🚀 Starting Mercari Model Training...\n');

    // Get max samples from command line argument (default: 10000)
    const maxSamples = parseInt(process.argv[2]) || 10000;

    console.log(`Configuration:`);
    console.log(`- Max training samples: ${maxSamples.toLocaleString()}`);
    console.log(`- Model type: Random Forest Regression`);
    console.log(`- Features: category, condition, brand, description, shipping\n`);

    try {
        const success = await trainWithMercariData(maxSamples);

        if (success) {
            console.log('\n✅ Model training completed successfully!');
            console.log('The model is now ready to use for price predictions.');
            process.exit(0);
        } else {
            console.error('\n❌ Model training failed.');
            console.log('Please check the error messages above.');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Fatal error during training:', error);
        process.exit(1);
    }
}

main();
