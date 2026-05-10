#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, 'public/file.png');

async function generateIcons() {
  console.log('Generating favicon and PWA icons...');

  try {
    // Verify logo exists
    if (!fs.existsSync(LOGO_PATH)) {
      console.error('❌ Error: BIDPaL Logo V2.png not found at', LOGO_PATH);
      process.exit(1);
    }

    // Generate 192x192 icon with smaller logo (60% of canvas size)
    const icon192Path = path.join(__dirname, 'public/icon-192.png');
    await sharp(LOGO_PATH)
      .resize(115, 115, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .composite([
        {
          input: Buffer.from([255, 255, 255, 255]),
          tile: true,
          blend: 'dest-out',
          raw: { width: 1, height: 1, channels: 4 }
        }
      ])
      .toBuffer()
      .then(buffer => {
        return sharp({
          create: {
            width: 192,
            height: 192,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          }
        })
          .composite([{ input: buffer, gravity: 'center' }])
          .png()
          .toFile(icon192Path);
      });
    console.log('✅ Generated icon-192.png');

    // Generate 512x512 icon with smaller logo (60% of canvas size)
    const icon512Path = path.join(__dirname, 'public/icon-512.png');
    await sharp(LOGO_PATH)
      .resize(307, 307, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .composite([
        {
          input: Buffer.from([255, 255, 255, 255]),
          tile: true,
          blend: 'dest-out',
          raw: { width: 1, height: 1, channels: 4 }
        }
      ])
      .toBuffer()
      .then(buffer => {
        return sharp({
          create: {
            width: 512,
            height: 512,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          }
        })
          .composite([{ input: buffer, gravity: 'center' }])
          .png()
          .toFile(icon512Path);
      });
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
        .resize(115, 115, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .png()
        .toBuffer()
        .then(buffer => {
          return sharp({
            create: {
              width: 192,
              height: 192,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
          })
            .composite([{ input: buffer, gravity: 'center' }])
            .png()
            .toFile(adminIcon192Path);
        });
      console.log('✅ Generated admin/public/icon-192.png');

      const adminIcon512Path = path.join(adminPublicPath, 'icon-512.png');
      await sharp(LOGO_PATH)
        .resize(307, 307, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .png()
        .toBuffer()
        .then(buffer => {
          return sharp({
            create: {
              width: 512,
              height: 512,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
          })
            .composite([{ input: buffer, gravity: 'center' }])
            .png()
            .toFile(adminIcon512Path);
        });
      console.log('✅ Generated admin/public/icon-512.png');
    }

    console.log('\n✅ All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
