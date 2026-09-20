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
    ctx.roundRect(8, 8, width - 16, height - 16, 24);
    ctx.fill();
    ctx.stroke();

    // Inner White Sticker Label Base
    const plateX = width * 0.05;
    const plateY = height * 0.12;
    const plateW = width * 0.90;
    const plateH = height * 0.76;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1C1E21';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(plateX, plateY, plateW, plateH, 12);
    ctx.fill();
    ctx.stroke();

    const topTextY = plateY + 14;

    // --------------------------------------------------
    // COMPONENT 1: WORKER ID / QR CODE (Left: 4% to 26%)
    // --------------------------------------------------
    const qrSize = Math.floor(plateH * 0.52);
    const qrX = plateX + Math.floor(plateW * 0.04);
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

    ctx.fillStyle = '#1C1E21';
    ctx.font = '600 8px Inter, sans-serif';
    ctx.fillText('Worker ID / QR', qrX - 2, topTextY);

    // Printed Expiry Date Below QR
    ctx.fillStyle = '#2B303A';
    ctx.font = '700 7.5px Inter, monospace';
    ctx.fillText('EXP: 2028-12-31', qrX - 2, qrY + qrSize + 11);

    // --------------------------------------------------
    // COMPONENT 2: REACTIVE WINDOW (Cu-Acetate Strip) (30% to 50%)
    // --------------------------------------------------
    const patchX = plateX + Math.floor(plateW * 0.30);
    const patchW = Math.floor(plateW * 0.20);
    const patchH = Math.floor(plateH * 0.54);
    const patchY = plateY + 22;

    const sensorRgb = ColorimetryEngine.getSimulatedSensorRgb(dosePpmH);
    const sensorHex = ColorimetryEngine.rgbToHex(sensorRgb);

    ctx.fillStyle = sensorHex;
    ctx.strokeStyle = '#3A3F47';
    ctx.lineWidth = 1.2;
    ctx.fillRect(patchX, patchY, patchW, patchH);
    ctx.strokeRect(patchX, patchY, patchW, patchH);

    ctx.fillStyle = '#1C1E21';
    ctx.font = '600 8px Inter, sans-serif';
    ctx.fillText('Reactive Window', patchX - 2, topTextY);

    // --------------------------------------------------
    // COMPONENT 3: PRINTED REFERENCE SCALE (Calibrated Tan/Brown: 54% to 76%)
    // --------------------------------------------------
    const refX = plateX + Math.floor(plateW * 0.54);
    const refW = Math.floor(plateW * 0.22);
    const refH = patchH;
    const refY = patchY;

    ctx.strokeStyle = '#1C1E21';
    ctx.lineWidth = 1;

    // Calibrated 6-swatch tan/brown H2S dosimetry reference scale (matches scan result screen)
    const refColors = ['#F7F0E4', '#DDC49B', '#C79F62', '#A9793F', '#8A5A2A', '#4A2E15'];
    const stepW = refW / refColors.length;
    refColors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(refX + i * stepW, refY, stepW, refH);
      ctx.strokeRect(refX + i * stepW, refY, stepW, refH);
    });

    ctx.fillStyle = '#1C1E21';
    ctx.font = '600 8px Inter, sans-serif';
    ctx.fillText('Reference Scale', refX - 2, topTextY);

    // --------------------------------------------------
    // COMPONENT 4: EXPIRY / VALIDITY PATCH (88% to 96%)
    // --------------------------------------------------
    const expiryRadius = Math.floor(patchH * 0.38);
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

    ctx.fillStyle = '#1C1E21';
    ctx.font = '600 8px Inter, sans-serif';
    ctx.fillText('Expiry Patch', expiryX - expiryRadius - 2, topTextY);

    // Footer label
    ctx.fillStyle = 'rgba(28, 30, 33, 0.75)';
    ctx.font = '600 8px Inter, sans-serif';
    ctx.fillText(`${badgeId} · BATCH ${batchId} · EXP: 2028-12-31`, plateX + 10, plateY + plateH + 11);
  }
}
