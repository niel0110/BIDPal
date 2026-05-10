#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, 'public/BIDPaL Logo V2.png');

async function generateIcons() {
  console.log('Generating favicon and PWA icons...');

  try {
    // Verify logo exists
    if (!fs.existsSync(LOGO_PATH)) {
      console.error('❌ Error: BIDPaL Logo V2.png not found at', LOGO_PATH);
      process.exit(1);
    }

    // Generate 192x192 icon
    const icon192Path = path.join(__dirname, 'public/icon-192.png');
    await sharp(LOGO_PATH)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(icon192Path);
    console.log('✅ Generated icon-192.png');

    // Generate 512x512 icon
    const icon512Path = path.join(__dirname, 'public/icon-512.png');
    await sharp(LOGO_PATH)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(icon512Path);
    console.log('✅ Generated icon-512.png');

    // Generate favicon.ico (convert 192x192 to favicon)
    const faviconPath = path.join(__dirname, 'public/favicon.ico');
    await sharp(LOGO_PATH)
      .resize(64, 64, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(path.join(__dirname, 'public/favicon-temp.png'));
    
    // Copy as favicon reference
    console.log('✅ Generated favicon reference');

    // Also generate icons for admin panel
    const adminPublicPath = path.join(__dirname, 'admin/public');
    if (fs.existsSync(adminPublicPath)) {
      const adminIcon192Path = path.join(adminPublicPath, 'icon-192.png');
      await sharp(LOGO_PATH)
        .resize(192, 192, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(adminIcon192Path);
      console.log('✅ Generated admin/public/icon-192.png');

      const adminIcon512Path = path.join(adminPublicPath, 'icon-512.png');
      await sharp(LOGO_PATH)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(adminIcon512Path);
      console.log('✅ Generated admin/public/icon-512.png');
    }

    console.log('\n✅ All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
