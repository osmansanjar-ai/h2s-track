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
    ctx.fillStyle = '#EBE3D3';
    ctx.strokeStyle = '#D5CAAF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(8, 8, width - 16, height - 16, 28);
    ctx.fill();
    ctx.stroke();

    // Inner White Sticker Label Base
    const plateX = width * 0.08;
    const plateY = height * 0.15;
    const plateW = width * 0.84;
    const plateH = height * 0.70;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1C1E21';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(plateX, plateY, plateW, plateH, 12);
    ctx.fill();
    ctx.stroke();

    // --------------------------------------------------
    // COMPONENT 1: WORKER ID / QR CODE (Left)
    // --------------------------------------------------
    const qrSize = Math.floor(plateH * 0.70);
    const qrX = plateX + 16;
    const qrY = plateY + (plateH - qrSize) / 2;

    ctx.fillStyle = '#1C1E21';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);

    // QR finder blocks
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX + 4, qrY + 4, 10, 10);
    ctx.fillRect(qrX + qrSize - 14, qrY + 4, 10, 10);
    ctx.fillRect(qrX + 4, qrY + qrSize - 14, 10, 10);
    ctx.fillRect(qrX + 14, qrY + 14, 8, 8);
    ctx.fillStyle = '#1C1E21';
    ctx.fillRect(qrX + 7, qrY + 7, 4, 4);
    ctx.fillRect(qrX + qrSize - 11, qrY + 7, 4, 4);
    ctx.fillRect(qrX + 7, qrY + qrSize - 11, 4, 4);

    ctx.fillStyle = '#1C1E21';
    ctx.font = '600 8px Inter, sans-serif';
    ctx.fillText('Worker ID / QR', qrX - 2, qrY - 5);

    // --------------------------------------------------
    // COMPONENT 2: REACTIVE WINDOW (Copper-Acetate Strip)
    // --------------------------------------------------
    const patchW = Math.floor(plateW * 0.28);
    const patchH = Math.floor(plateH * 0.65);
    const patchX = qrX + qrSize + 16;
    const patchY = plateY + (plateH - patchH) / 2;

    const sensorRgb = ColorimetryEngine.getSimulatedSensorRgb(dosePpmH);
    const sensorHex = ColorimetryEngine.rgbToHex(sensorRgb);

    ctx.fillStyle = sensorHex;
    ctx.strokeStyle = '#3A3F47';
    ctx.lineWidth = 1.2;
    ctx.fillRect(patchX, patchY, patchW, patchH);
    ctx.strokeRect(patchX, patchY, patchW, patchH);

    ctx.fillStyle = '#1C1E21';
    ctx.font = '600 8px Inter, sans-serif';
    ctx.fillText('Reactive window (Cu-acetate)', patchX - 4, patchY - 5);

    // --------------------------------------------------
    // COMPONENT 3: PRINTED REFERENCE SCALE (Grayscale)
    // --------------------------------------------------
    const refW = Math.floor(plateW * 0.22);
    const refH = patchH;
    const refX = patchX + patchW + 16;
    const refY = patchY;

    ctx.strokeStyle = '#1C1E21';
    ctx.lineWidth = 1;

    const refColors = ['#F5F5F5', '#CCCCCC', '#999999', '#555555', '#1C1E21'];
    const stepW = refW / refColors.length;
    refColors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(refX + i * stepW, refY, stepW, refH);
      ctx.strokeRect(refX + i * stepW, refY, stepW, refH);
    });

    ctx.fillStyle = '#1C1E21';
    ctx.font = '600 8px Inter, sans-serif';
    ctx.fillText('Reference scale', refX - 2, refY - 5);

    // --------------------------------------------------
    // COMPONENT 4: EXPIRY / VALIDITY PATCH (Circular Sealed Ring)
    // --------------------------------------------------
    const expiryRadius = Math.floor(patchH / 2);
    const expiryX = refX + refW + 28 + expiryRadius;
    const expiryY = patchY + expiryRadius;

    // Outer hermetic seal ring
    ctx.fillStyle = '#D6DECB';
    ctx.strokeStyle = '#5E6B56';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(expiryX, expiryY, expiryRadius + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner sealed reactive chemistry patch
    // If expired, darkens from heat/time degradation
    ctx.fillStyle = isExpired ? '#595244' : '#E1F0E5';
    ctx.beginPath();
    ctx.arc(expiryX, expiryY, expiryRadius - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1C1E21';
    ctx.font = '600 8px Inter, sans-serif';
    ctx.fillText('Expiry / validity patch', expiryX - expiryRadius - 4, patchY - 5);

    // Footer label
    ctx.fillStyle = 'rgba(28, 30, 33, 0.5)';
    ctx.font = '500 8px Inter, sans-serif';
    ctx.fillText(`${badgeId} · BATCH ${batchId}`, plateX + 12, plateY + plateH + 11);
  }
}
