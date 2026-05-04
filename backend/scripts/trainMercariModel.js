import dotenv from 'dotenv';
dotenv.config();

import { trainWithMercariData } from '../services/mlModelService.js';

function parseSampleArg(value) {
    if (!value) return 'full';
    const normalized = value.toString().trim().toLowerCase();
    if (['full', 'all', '1.4m', 'full-dataset'].includes(normalized)) return 'full';
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 'full';
}

async function main() {
    const sampleArg = parseSampleArg(process.argv[2]);
    const isFullRun = sampleArg === 'full';

    console.log('Starting Mercari Random Forest training');
    console.log('Configuration:');
    console.log(`- Training rows: ${isFullRun ? 'full Mercari dataset' : sampleArg.toLocaleString()}`);
    console.log(`- Trees: ${process.env.PRICE_RF_TREES || 150}`);
    console.log(`- Max depth: ${process.env.PRICE_RF_MAX_DEPTH || 16}`);
    console.log('- Feature version: 3');

    const success = await trainWithMercariData(sampleArg);

    if (!success) {
        console.error('Model training failed.');
        process.exit(1);
    }

    console.log('Model training completed successfully.');
    process.exit(0);
}

main().catch(error => {
    console.error('Fatal error during training:', error);
    process.exit(1);
});
