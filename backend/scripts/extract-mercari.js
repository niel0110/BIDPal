import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const ARCHIVE_PATH = path.join(DATA_DIR, 'train.tsv.7z');
const OUTPUT_PATH = path.join(DATA_DIR, 'train.tsv');

async function extract7z() {
    console.log('🔍 Checking for archive...');

    if (!fs.existsSync(ARCHIVE_PATH)) {
        console.error('❌ Archive not found:', ARCHIVE_PATH);
        console.log('Please download train.tsv.7z to the data directory');
        process.exit(1);
    }

    if (fs.existsSync(OUTPUT_PATH)) {
        console.log('✅ train.tsv already exists!');
        const stats = fs.statSync(OUTPUT_PATH);
        console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        return;
    }

    console.log('📦 Extracting train.tsv.7z...');
    console.log('This may take a few minutes...\n');

    try {
        // Try using 7z if available in PATH
        const { stdout, stderr } = await execAsync(`7z x "${ARCHIVE_PATH}" -o"${DATA_DIR}" -y`, {
            cwd: DATA_DIR
        });

        console.log(stdout);
        if (stderr) console.error(stderr);

        console.log('✅ Extraction complete!');

        if (fs.existsSync(OUTPUT_PATH)) {
            const stats = fs.statSync(OUTPUT_PATH);
            console.log(`✅ train.tsv extracted successfully`);
            console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        }
    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('not recognized')) {
            console.error('\n❌ 7-Zip not found in PATH');
            console.log('\n📥 Please extract manually:');
            console.log('   1. Download 7-Zip from: https://www.7-zip.org/download.html');
            console.log('   2. Right-click train.tsv.7z → 7-Zip → Extract Here');
            console.log('   OR');
            console.log('   3. Add 7-Zip to your PATH and run this script again');
            process.exit(1);
        } else {
            console.error('❌ Extraction error:', error.message);
            process.exit(1);
        }
    }
}

extract7z();
