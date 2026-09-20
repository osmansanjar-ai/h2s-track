// Canvas Badge Renderer for Interactive Simulation & Camera Testing (SIH 2026 Design)
// Layout: [ Worker ID / QR ] -> [ Reactive Window (Cu-Acetate Strip) ] -> [ Printed Reference Scale ] -> [ Expiry Patch ]

import { ColorimetryEngine } from '../services/colorimetryEngine.js';

export class SimulatedBadge {
  static drawBadge(canvas, dosePpmH = 12.7, badgeId = 'H2S-001', batchId = 'H2S-2026-001', isExpired = false) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // 1. Background Yellow Silicone Wristband Substrate
    ctx.fillStyle = '#F0C419';
    ctx.strokeStyle = '#D9A700';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(6, 6, width - 12, height - 12, 22);
    ctx.fill();
    ctx.stroke();

    // Inner White Sticker Label Base
    const plateX = width * 0.04;
    const plateY = height * 0.10;
    const plateW = width * 0.92;
    const plateH = height * 0.80;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1C1E21';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(plateX, plateY, plateW, plateH, 10);
    ctx.fill();
    ctx.stroke();

    const topTextY = plateY + 14;

    // --------------------------------------------------
    // COMPONENT 1: WORKER ID / QR CODE (Left: 3% to 24%)
    // --------------------------------------------------
    const qrSize = Math.floor(plateH * 0.52);
    const qrX = plateX + Math.floor(plateW * 0.03);
    const qrY = plateY + 22;

    ctx.fillStyle = '#1C1E21';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);

    // QR finder blocks
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX + 3, qrY + 3, 8, 8);
    ctx.fillRect(qrX + qrSize - 11, qrY + 3, 8, 8);
    ctx.fillRect(qrX + 3, qrY + qrSize - 11, 8, 8);
    ctx.fillRect(qrX + 11, qrY + 11, 6, 6);
    ctx.fillStyle = '#1C1E21';
    ctx.fillRect(qrX + 5, qrY + 5, 4, 4);
    ctx.fillRect(qrX + qrSize - 9, qrY + 5, 4, 4);
    ctx.fillRect(qrX + 5, qrY + qrSize - 9, 4, 4);

    ctx.fillStyle = '#1E293B';
    ctx.font = '600 7.5px Inter, sans-serif';
    ctx.fillText('Worker ID / QR', qrX, topTextY);

    // Printed Expiry Date Below QR
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 7px Inter, monospace';
    ctx.fillText('EXP: 2028-12-31', qrX, qrY + qrSize + 11);

    // --------------------------------------------------
    // COMPONENT 2: REACTIVE WINDOW (Cu-Acetate Strip) (28% to 48%)
    // --------------------------------------------------
    const patchX = plateX + Math.floor(plateW * 0.28);
    const patchW = Math.floor(plateW * 0.20);
    const patchH = Math.floor(plateH * 0.54);
    const patchY = plateY + 22;

    const sensorRgb = ColorimetryEngine.getSimulatedSensorRgb(dosePpmH);
    const sensorHex = ColorimetryEngine.rgbToHex(sensorRgb);

    ctx.fillStyle = sensorHex;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(patchX, patchY, patchW, patchH, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1E293B';
    ctx.font = '600 7.5px Inter, sans-serif';
    ctx.fillText('Reactive Window', patchX, topTextY);

    // --------------------------------------------------
    // COMPONENT 3: PRINTED REFERENCE SCALE (5 Calibrated Swatches: 52% to 75%)
    // --------------------------------------------------
    const refX = plateX + Math.floor(plateW * 0.52);
    const refW = Math.floor(plateW * 0.23);
    const refH = patchH;
    const refY = patchY;

    ctx.strokeStyle = '#1C1E21';
    ctx.lineWidth = 1;

    // 5-Step Calibrated Cu-Acetate / H2S reference scale specified by research table:
    // 1. #E1F0E5 (Pale Mint / Cream - 0 ppm·h)
    // 2. #B5C4AA (Light Sage Green - 60 ppm·h)
    // 3. #8C846D (Muted Olive-Grey - 120 ppm·h)
    // 4. #595244 (Dark Brownish-Grey - 180 ppm·h)
    // 5. #262420 (Near-Black CuS - 240 ppm·h)
    const refColors = ['#E1F0E5', '#B5C4AA', '#8C846D', '#595244', '#262420'];
    const stepW = refW / refColors.length;
    refColors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(refX + i * stepW, refY, stepW, refH);
      ctx.strokeRect(refX + i * stepW, refY, stepW, refH);
    });

    ctx.fillStyle = '#1E293B';
    ctx.font = '600 7.5px Inter, sans-serif';
    ctx.fillText('Reference Scale', refX, topTextY);

    // --------------------------------------------------
    // COMPONENT 4: EXPIRY / VALIDITY PATCH (80% to 96%)
    // --------------------------------------------------
    const expiryRadius = Math.floor(patchH * 0.35);
    const expiryX = plateX + Math.floor(plateW * 0.88);
    const expiryY = patchY + Math.floor(patchH / 2);

    // Outer hermetic seal ring
    ctx.fillStyle = '#D6DECB';
    ctx.strokeStyle = '#5E6B56';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(expiryX, expiryY, expiryRadius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner sealed reactive chemistry patch
    ctx.fillStyle = isExpired ? '#595244' : '#E1F0E5';
    ctx.beginPath();
    ctx.arc(expiryX, expiryY, expiryRadius - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1E293B';
    ctx.font = '600 7.5px Inter, sans-serif';
    ctx.fillText('Expiry Patch', expiryX - expiryRadius - 2, topTextY);

    // Footer label
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.font = '600 7.5px Inter, sans-serif';
    ctx.fillText(`${badgeId} · BATCH ${batchId} · EXP: 2028-12-31`, plateX + 10, plateY + plateH + 11);
  }
}
