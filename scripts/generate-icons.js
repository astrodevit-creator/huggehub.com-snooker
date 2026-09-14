import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = path.resolve('public/icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generate() {
  await sharp(svgBuffer).resize(192, 192).png().toFile('public/pwa-192x192.png');
  await sharp(svgBuffer).resize(512, 512).png().toFile('public/pwa-512x512.png');
  await sharp(svgBuffer).resize(180, 180).png().toFile('public/apple-touch-icon.png');
  await sharp(svgBuffer).resize(64, 64).png().toFile('public/favicon.ico');
  console.log('Successfully generated all PWA PNG and ICO icons!');
}

generate().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
