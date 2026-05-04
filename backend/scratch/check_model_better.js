import fs from 'fs';
import path from 'path';

const MODEL_PATH = 'c:/Users/ds_admin/.gemini/antigravity/scratch/BIDPal/backend/data/models/price_rf_model.json';

if (fs.existsSync(MODEL_PATH)) {
    const content = fs.readFileSync(MODEL_PATH, 'utf8');
    const persisted = JSON.parse(content);
    console.log('Keys in model file:', Object.keys(persisted));
    if (persisted.metadata) {
        console.log('Metadata:', JSON.stringify(persisted.metadata, null, 2));
    } else {
        console.log('No metadata found.');
        // Maybe it's just the model data directly?
        if (persisted.name === 'RandomForestRegression') {
            console.log('File contains direct RandomForestRegression data.');
            console.log('nEstimators:', persisted.nEstimators);
            console.log('maxDepth:', persisted.maxDepth);
        }
    }
} else {
    console.log('Model not found at', MODEL_PATH);
}
