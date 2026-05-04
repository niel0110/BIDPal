import fs from 'fs';
import path from 'path';

const MODEL_PATH = 'c:/Users/ds_admin/.gemini/antigravity/scratch/BIDPal/backend/data/models/price_rf_model.json';

if (fs.existsSync(MODEL_PATH)) {
    const persisted = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
    console.log('Current Model Metadata:');
    console.log(JSON.stringify(persisted.metadata, null, 2));
} else {
    console.log('Model not found at', MODEL_PATH);
}
