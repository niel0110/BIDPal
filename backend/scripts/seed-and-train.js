import { trainModel } from '../services/mlModelService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const datasetPath = path.join(__dirname, '../data/marketDataset.json');

async function main() {
    console.log('🌱 Starting synthetic data seeding and training...');
    
    if (!fs.existsSync(datasetPath)) {
        console.error('❌ Market dataset not found. Cannot seed.');
        return;
    }

    const { categories } = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    const trainingData = [];

    // Generate 50 synthetic data points per category
    Object.entries(categories).forEach(([catName, data]) => {
        const brands = data.popularBrands || ['Generic'];
        const baseAvg = data.averagePrice;
        
        for (let i = 0; i < 50; i++) {
            const brand = brands[Math.floor(Math.random() * brands.length)];
            const conditions = Object.keys(data.depreciation);
            const condition = conditions[Math.floor(Math.random() * conditions.length)];
            const dep = data.depreciation[condition];
            
            // Add some noise (randomness)
            const noise = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
            const storage = [64, 128, 256, 512][Math.floor(Math.random() * 4)];
            
            let finalPrice = baseAvg * dep * noise;
            if (brand === 'Apple') finalPrice *= 1.2; // Apple Tax
            if (storage > 128) finalPrice += (storage - 128) * 50;

            trainingData.push({
                category: catName,
                brand,
                condition,
                specs: { storage: `${storage}GB` },
                finalPrice: Math.round(finalPrice)
            });
        }
    });

    console.log(`📊 Generated ${trainingData.length} synthetic samples.`);
    
    await trainModel(trainingData);
    
    console.log('✅ Seeding and training complete!');
}

main().catch(console.error);
