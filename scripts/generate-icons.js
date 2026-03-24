#!/usr/bin/env node

// NSFW-Away — Icon Generator
// Generates simple shield-style PNG icons at 16, 32, 48, 128px.
// Uses pure Node.js (no dependencies) to create minimal PNG files.
//
// The icon is a simple colored shield shape (blue when enabled, grey when disabled).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICONS_DIR = path.join(__dirname, '..', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// --- Minimal PNG encoder ---

function crc32(buf) {
  let crc = 0xffffffff;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const combined = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, combined, crc]);
}

function createPNG(width, height, pixels) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT - raw pixel data with filter byte per row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];     // R
      rawData[dstIdx + 1] = pixels[srcIdx + 1]; // G
      rawData[dstIdx + 2] = pixels[srcIdx + 2]; // B
      rawData[dstIdx + 3] = pixels[srcIdx + 3]; // A
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', iend)
  ]);
}

// --- Icon drawing ---

function drawShieldIcon(size, r, g, b) {
  const pixels = Buffer.alloc(size * size * 4, 0);

  const cx = size / 2;
  const topY = size * 0.08;
  const bottomY = size * 0.92;
  const maxWidth = size * 0.40;
  const midY = size * 0.55; // where shield starts narrowing

  function setPixel(x, y, pr, pg, pb, pa) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (Math.floor(y) * size + Math.floor(x)) * 4;
    pixels[idx] = pr;
    pixels[idx + 1] = pg;
    pixels[idx + 2] = pb;
    pixels[idx + 3] = pa;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let halfWidth;
      if (y < topY || y > bottomY) {
        continue;
      }

      if (y <= midY) {
        // Top section: rounded rectangle
        halfWidth = maxWidth;
        // Round the top corners
        const cornerR = size * 0.12;
        if (y < topY + cornerR) {
          const dy = topY + cornerR - y;
          if (Math.abs(x - cx) > maxWidth - cornerR) {
            const dx = Math.abs(x - cx) - (maxWidth - cornerR);
            if (dx * dx + dy * dy > cornerR * cornerR) continue;
          }
        }
      } else {
        // Bottom section: narrows to a point
        const progress = (y - midY) / (bottomY - midY);
        halfWidth = maxWidth * (1 - progress);
      }

      if (Math.abs(x - cx) <= halfWidth) {
        // Slightly lighter top area for depth
        const shade = y < midY ? 1.0 : (0.85 + 0.15 * (1 - (y - midY) / (bottomY - midY)));
        const sr = Math.min(255, Math.round(r * shade));
        const sg = Math.min(255, Math.round(g * shade));
        const sb = Math.min(255, Math.round(b * shade));
        setPixel(x, y, sr, sg, sb, 255);
      }
    }
  }

  // Draw a simple checkmark or line in the center (white)
  const lineSize = Math.max(1, Math.round(size * 0.06));
  const checkCx = cx;
  const checkCy = size * 0.42;
  const checkSize = size * 0.18;

  // Draw a simple "block" / stop hand symbol - a horizontal bar
  for (let dy = -checkSize * 0.3; dy <= checkSize * 0.3; dy++) {
    for (let dx = -checkSize; dx <= checkSize; dx++) {
      setPixel(
        Math.round(checkCx + dx),
        Math.round(checkCy + dy),
        255, 255, 255, 220
      );
    }
  }

  return pixels;
}

// --- Generate icons ---

const sizes = [16, 32, 48, 128];

// Enabled icons (blue shield)
for (const size of sizes) {
  const pixels = drawShieldIcon(size, 0, 121, 211); // Reddit blue
  const png = createPNG(size, size, pixels);
  const filePath = path.join(ICONS_DIR, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created: icons/icon-${size}.png`);
}

// Disabled icons (grey shield)
for (const size of sizes) {
  const pixels = drawShieldIcon(size, 150, 150, 150); // Grey
  const png = createPNG(size, size, pixels);
  const filePath = path.join(ICONS_DIR, `icon-disabled-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created: icons/icon-disabled-${size}.png`);
}

console.log('\nAll icons generated successfully.');
