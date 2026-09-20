import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, pixelFn) {
  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA (6)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw IDAT data
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const idx = 1 + x * 4;
      row[idx] = r;
      row[idx + 1] = g;
      row[idx + 2] = b;
      row[idx + 3] = a;
    }
    rawRows.push(row);
  }

  const rawData = Buffer.concat(rawRows);
  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const payload = Buffer.concat([typeBuf, data]);

  const crcVal = crc32(payload);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal >>> 0, 0);

  return Buffer.concat([len, payload, crcBuf]);
}

// Standard CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return crc ^ -1;
}

// Write SVG logo
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <path d="M20 3L6 8V19C6 27.5 12 34.5 20 37C28 34.5 34 27.5 34 19V8L20 3Z" fill="#0F172A" stroke="#F59E0B" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M13 20C13 16.1 16.1 13 20 13C23.9 13 27 16.1 27 20" stroke="#F0C419" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2 1.5"/>
  <line x1="20" y1="18" x2="16" y2="23" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
  <line x1="20" y1="18" x2="24" y2="23" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
  <circle cx="20" cy="17" r="3.2" fill="#F59E0B"/>
  <circle cx="15.5" cy="23.5" r="2.2" fill="#F8FAFC"/>
  <circle cx="24.5" cy="23.5" r="2.2" fill="#F8FAFC"/>
  <circle cx="20" cy="30" r="2.5" fill="#10B981"/>
</svg>`;

fs.writeFileSync('public/favicon.svg', svgContent);
fs.writeFileSync('public/logo.svg', svgContent);

// Draw rasterized high-resolution shield logo pixel function for PNG/ICO
const pngBuffer = createPNG(64, 64, (x, y, w, h) => {
  const nx = x / w;
  const ny = y / h;

  // Simple shield shape outline formula
  // Center is (0.5, 0.5)
  const dx = Math.abs(nx - 0.5);

  // Top triangular point at ny=0.08, flat top angled down to ny=0.20 at dx=0.35, curve down to bottom tip at (0.5, 0.92)
  let shieldBoundary = 0;
  if (ny < 0.20) {
    shieldBoundary = 0.35 * (ny - 0.08) / 0.12;
  } else if (ny < 0.50) {
    shieldBoundary = 0.35;
  } else if (ny <= 0.92) {
    const t = (ny - 0.50) / 0.42;
    shieldBoundary = 0.35 * Math.sqrt(Math.max(0, 1 - t * t));
  }

  // Outside shield: transparent
  if (dx > shieldBoundary || ny < 0.08 || ny > 0.92) {
    return [0, 0, 0, 0];
  }

  // Border ring check (stroke width ~ 0.04)
  const borderMargin = 0.035;
  const isBorder = (shieldBoundary - dx < borderMargin) || (ny - 0.08 < borderMargin) || (0.92 - ny < borderMargin);

  if (isBorder) {
    return [245, 158, 11, 255]; // Amber Border #F59E0B
  }

  // Background #0F172A
  let r = 15, g = 23, b = 42, a = 255;

  // Yellow Radar Arc (radius 0.18 around (0.5, 0.5))
  const distCenter = Math.hypot(nx - 0.5, ny - 0.48);
  if (Math.abs(distCenter - 0.18) < 0.025 && ny <= 0.48) {
    r = 240; g = 196; b = 25; // #F0C419
  }

  // Bonds (lines from 0.5, 0.42 to 0.39, 0.57 and 0.61, 0.57)
  const dLine1 = Math.abs((ny - 0.42) * 0.11 - (nx - 0.5) * 0.15) / Math.hypot(0.11, 0.15);
  const dLine2 = Math.abs((ny - 0.42) * (-0.11) - (nx - 0.5) * 0.15) / Math.hypot(-0.11, 0.15);
  if ((dLine1 < 0.02 || dLine2 < 0.02) && ny >= 0.42 && ny <= 0.58 && dx <= 0.12) {
    r = 148; g = 163; b = 184; // #94A3B8
  }

  // Central Sulfur Atom (0.5, 0.42, r=0.08)
  const distSulfur = Math.hypot(nx - 0.5, ny - 0.42);
  if (distSulfur <= 0.075) {
    r = 245; g = 158; b = 11; // Amber #F59E0B
  }

  // Hydrogen Atom Left (0.39, 0.57, r=0.05)
  const distH1 = Math.hypot(nx - 0.39, ny - 0.57);
  if (distH1 <= 0.05) {
    r = 248; g = 250; b = 252; // #F8FAFC
  }

  // Hydrogen Atom Right (0.61, 0.57, r=0.05)
  const distH2 = Math.hypot(nx - 0.61, ny - 0.57);
  if (distH2 <= 0.05) {
    r = 248; g = 250; b = 252; // #F8FAFC
  }

  // Green Active Indicator Dot (0.5, 0.75, r=0.065)
  const distGreen = Math.hypot(nx - 0.5, ny - 0.74);
  if (distGreen <= 0.06) {
    r = 16; g = 185; b = 129; // Green #10B981
  }

  return [r, g, b, a];
});

fs.writeFileSync('public/favicon.png', pngBuffer);
fs.writeFileSync('public/favicon.ico', pngBuffer);
console.log('✅ Updated public/favicon.svg, public/favicon.png, public/favicon.ico, and public/logo.svg successfully!');
