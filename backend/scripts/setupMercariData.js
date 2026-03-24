import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '../data');

/**
 * Setup script for Mercari dataset
 *
 * This script:
 * 1. Checks if Kaggle is authenticated
 * 2. Downloads the Mercari dataset if not present
 * 3. Extracts the TSV files
 * 4. Verifies the data
 */

async function main() {
    console.log('🔧 Mercari Dataset Setup\n');

    // Step 1: Check data directory
    if (!fs.existsSync(dataDir)) {
        console.log('📁 Creating data directory...');
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Step 2: Check if data already exists
    const trainFile = path.join(dataDir, 'train.tsv');
    const zipFile = path.join(dataDir, 'mercari-price-suggestion-challenge.zip');

    if (fs.existsSync(trainFile)) {
        console.log('✅ train.tsv already exists');
        const stats = fs.statSync(trainFile);
        console.log(`   File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        console.log('\n📊 Dataset is ready to use!');
        console.log('Run: node scripts/trainMercariModel.js');
        return;
    }

    // Step 3: Check if zip exists
    if (fs.existsSync(zipFile)) {
        console.log('📦 Found downloaded zip file, extracting...');

        try {
            // On Windows, use tar (built-in) or 7zip
            if (process.platform === 'win32') {
                console.log('🔓 Extracting with tar...');
                execSync(`tar -xf "${zipFile}" -C "${dataDir}"`, { stdio: 'inherit' });
            } else {
                console.log('🔓 Extracting with unzip...');
                execSync(`unzip -o "${zipFile}" -d "${dataDir}"`, { stdio: 'inherit' });
            }

            console.log('✅ Extraction complete!');

            if (fs.existsSync(trainFile)) {
                console.log('\n📊 Dataset is ready to use!');
                console.log('Run: node scripts/trainMercariModel.js');
            } else {
                console.log('\n⚠️ train.tsv not found after extraction');
                console.log('Please check the zip file contents');
            }
        } catch (error) {
            console.error('❌ Error extracting zip:', error.message);
            console.log('\nPlease extract manually:');
            console.log(`Zip file: ${zipFile}`);
            console.log(`Extract to: ${dataDir}`);
        }

        return;
    }

    // Step 4: Download dataset
    console.log('📥 Dataset not found. Attempting to download...\n');
    console.log('Prerequisites:');
    console.log('1. Kaggle account');
    console.log('2. Kaggle API credentials (~/.kaggle/kaggle.json)');
    console.log('3. Accept competition rules at:');
    console.log('   https://www.kaggle.com/competitions/mercari-price-suggestion-challenge\n');

    try {
        console.log('Downloading dataset...');
        execSync(
            'kaggle competitions download -c mercari-price-suggestion-challenge',
            { cwd: dataDir, stdio: 'inherit' }
        );

        console.log('\n✅ Download complete!');
        console.log('Now extracting...');

        // Extract
        if (process.platform === 'win32') {
            execSync(`tar -xf "${zipFile}" -C "${dataDir}"`, { stdio: 'inherit' });
        } else {
            execSync(`unzip -o "${zipFile}" -d "${dataDir}"`, { stdio: 'inherit' });
        }

        console.log('\n✅ Setup complete!');
        console.log('Run: node scripts/trainMercariModel.js');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\nManual setup instructions:');
        console.log('1. Download from: https://www.kaggle.com/competitions/mercari-price-suggestion-challenge/data');
        console.log(`2. Extract to: ${dataDir}`);
        console.log('3. Ensure train.tsv is present');
        console.log('\nOr set up Kaggle CLI:');
        console.log('1. Create API token at: https://www.kaggle.com/settings/account');
        console.log('2. Place kaggle.json in ~/.kaggle/ (or C:\\Users\\<username>\\.kaggle\\ on Windows)');
        console.log('3. Run this script again');
    }
}

main().catch(console.error);
