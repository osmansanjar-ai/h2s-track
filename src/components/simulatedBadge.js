// Canvas Badge Renderer for Interactive Simulation & Camera Testing (SIH 2026 Design V2)
// Layout: [ H2S-Track & QR ] -> [ Corner Fiducials + Reactive Window (Exposure Scale) ] -> [ Vertical Reference Bar ] -> [ Expiry & Circular Seal ]

import { ColorimetryEngine } from '../services/colorimetryEngine.js';

export class SimulatedBadge {
  static drawBadge(canvas, dosePpmH = 12.7, badgeId = 'H2S-001', batchId = '202609-2701', isExpired = false) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // 1. Background Yellow Silicone Substrate (Wristband)
    ctx.fillStyle = '#FFDD40';
    ctx.strokeStyle = '#E6C220';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(4, 4, width - 8, height - 8, 20);
    ctx.fill();
    ctx.stroke();

    // Left Tab Extension
    ctx.fillStyle = '#FFDD40';
    ctx.beginPath();
    ctx.arc(6, height / 2, 14, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();

    // 2. Left White Label Plate (H2S-Track & QR Code)
    const plateX = width * 0.06;
    const plateY = height * 0.12;
    const plateW = width * 0.28;
    const plateH = height * 0.76;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(plateX, plateY, plateW, plateH, 12);
    ctx.fill();
    ctx.stroke();

    // H2S-Track Header
    ctx.fillStyle = '#000000';
    ctx.font = '900 13px Inter, sans-serif';
    ctx.fillText('H2S-Track', plateX + 10, plateY + 22);

    // QR Code
    const qrSize = Math.floor(plateH * 0.44);
    const qrX = plateX + 10;
    const qrY = plateY + 30;

    ctx.fillStyle = '#000000';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);

    // QR inner detail finder blocks
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX + 2, qrY + 2, 7, 7);
    ctx.fillRect(qrX + qrSize - 9, qrY + 2, 7, 7);
    ctx.fillRect(qrX + 2, qrY + qrSize - 9, 7, 7);
    ctx.fillRect(qrX + 9, qrY + 9, 5, 5);
    ctx.fillStyle = '#000000';
    ctx.fillRect(qrX + 4, qrY + 4, 3, 3);
    ctx.fillRect(qrX + qrSize - 7, qrY + 4, 3, 3);
    ctx.fillRect(qrX + 4, qrY + qrSize - 7, 3, 3);

    // Batch ID Text
    ctx.fillStyle = '#444444';
    ctx.font = '600 7px Inter, monospace';
    ctx.fillText(`H2S-Batch:${batchId}`, qrX + qrSize + 6, qrY + qrSize - 4);

    // --------------------------------------------------
    // 3. CENTRAL REACTIVE SENSOR WINDOW WITH 4 CORNER FIDUCIAL MARKERS
    // --------------------------------------------------
    const patchX = plateX + plateW + Math.floor(width * 0.04);
    const patchW = Math.floor(width * 0.25);
    const patchH = Math.floor(height * 0.68);
    const patchY = plateY + Math.floor((plateH - patchH) / 2);

    // Draw 4 Corner ArUco / Fiducial Alignment Targets (Black & White Squares)
    const fidSize = 9;
    const fiducials = [
      { x: patchX - fidSize - 2, y: patchY - fidSize - 2 },
      { x: patchX + patchW + 2, y: patchY - fidSize - 2 },
      { x: patchX - fidSize - 2, y: patchY + patchH + 2 },
      { x: patchX + patchW + 2, y: patchY + patchH + 2 }
    ];

    fiducials.forEach(f => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(f.x, f.y, fidSize, fidSize);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(f.x + 2, f.y + 2, fidSize - 4, fidSize - 4);
      ctx.fillStyle = '#000000';
      ctx.fillRect(f.x + 4, f.y + 4, 2, 2);
    });

    // Main Chemical Sensor Strip
    const sensorRgb = ColorimetryEngine.getSimulatedSensorRgb(dosePpmH);
    const sensorHex = ColorimetryEngine.rgbToHex(sensorRgb);

    ctx.fillStyle = sensorHex;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.roundRect(patchX, patchY, patchW, patchH, 8);
    ctx.fill();
    ctx.stroke();

    // Exposure Scale Label below patch
    ctx.fillStyle = '#111111';
    ctx.font = '700 7px Inter, sans-serif';
    ctx.fillText('Exposure Scale (H2-S)', patchX + Math.floor(patchW * 0.08), patchY + patchH + 11);

    // --------------------------------------------------
    // 4. VERTICAL REFERENCE SCALE (5 Calibrated Swatches)
    // --------------------------------------------------
    const refX = patchX + patchW + Math.floor(width * 0.04);
    const refW = 16;
    const refH = patchH;
    const refY = patchY;

    const refColors = ['#EDF5EF', '#C6D8C4', '#A1A895', '#5E5448', '#242220'];
    const swatchH = refH / refColors.length;

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;

    refColors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(refX, refY + i * swatchH, refW, swatchH);
      ctx.strokeRect(refX, refY + i * swatchH, refW, swatchH);
    });

    // --------------------------------------------------
    // 5. RIGHT EXPIRY STATUS SWATCHES & CIRCULAR SEAL
    // --------------------------------------------------
    const statusX = refX + refW + 28;
    const statusW = 14;
    const statusH = 10;
    const statusY = refY + 6;

    const statusList = [
      { text: 'Valid', color: '#EDF5EF' },
      { text: 'Expired', color: '#9E9E9E' },
      { text: 'Over-Expired', color: '#3E3E3E' }
    ];

    statusList.forEach((s, idx) => {
      const currentY = statusY + idx * 18;
      ctx.fillStyle = '#111111';
      ctx.font = '600 6.5px Inter, sans-serif';
      ctx.fillText(s.text, statusX - 22, currentY + 7);

      ctx.fillStyle = s.color;
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.fillRect(statusX, currentY, statusW, statusH);
      ctx.strokeRect(statusX, currentY, statusW, statusH);
    });

    // Far-Right Circular Seal Element
    const circleRadius = Math.floor(patchH * 0.48);
    const circleX = statusX + statusW + 28;
    const circleY = patchY + Math.floor(patchH / 2);

    // Outer Dark Circle
    ctx.fillStyle = '#555555';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner White Square
    const sqSize = Math.floor(circleRadius * 1.1);
    ctx.fillStyle = isExpired ? '#3E3E3E' : '#DDE5E0';
    ctx.fillRect(circleX - Math.floor(sqSize / 2), circleY - Math.floor(sqSize / 2), sqSize, sqSize);
  }
}
