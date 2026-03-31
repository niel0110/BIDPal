import { loadMercariData } from '../services/mercariDataLoader.js';

console.log('🚀 Starting Mercari dataset preprocessing...\n');
console.log('This will:');
console.log('  1. Read train.tsv (323 MB)');
console.log('  2. Process ~1.4M products');
console.log('  3. Convert USD to PHP');
console.log('  4. Create mercari_processed.json cache file');
console.log('  5. This may take 2-3 minutes...\n');

async function preprocessDataset() {
    const startTime = Date.now();

    try {
        const products = await loadMercariData();

        if (!products) {
            console.error('❌ Failed to load Mercari dataset');
            process.exit(1);
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('\n✅ Preprocessing complete!');
        console.log(`   Total products: ${products.length.toLocaleString()}`);
        console.log(`   Time taken: ${duration} seconds`);
        console.log(`   Cache file created: mercari_processed.json`);
        console.log('\n🎉 Your price recommendation service is ready to use!');

    } catch (error) {
        console.error('❌ Error during preprocessing:', error);
        process.exit(1);
    }
}

preprocessDataset();
