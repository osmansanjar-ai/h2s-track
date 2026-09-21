// Canvas Badge Renderer for Interactive Simulation & Camera Testing (SIH 2026 Design V2)
// Exact match to user V2 physical wristband spec (ArUco 4-point corners + Vertical Calibration Scale + Expiry Swatches)

import { ColorimetryEngine } from '../services/colorimetryEngine.js';

export class SimulatedBadge {
  static drawBadge(canvas, dosePpmH = 12.7, badgeId = 'H2S-001', batchId = '202609-2701', isExpired = false) {
    if (!canvas) return;

    // Ensure target canvas rendering dimensions
    canvas.width = 540;
    canvas.height = 175;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // --------------------------------------------------
    // 1. MAIN YELLOW SILICONE WRISTBAND SUBSTRATE
    // --------------------------------------------------
    const bandX = 14;
    const bandY = 10;
    const bandW = width - 28;
    const bandH = height - 20;

    // Outer Yellow Substrate Body
    ctx.fillStyle = '#FFDD40';
    ctx.strokeStyle = '#E6C020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bandX, bandY, bandW, bandH, 18);
    ctx.fill();
    ctx.stroke();

    // Left Rounded Tab Extension Nub
    ctx.fillStyle = '#FFDD40';
    ctx.beginPath();
    ctx.arc(bandX, height / 2, 11, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();

    // --------------------------------------------------
    // 2. LEFT WHITE LABEL PLATE (H2S-Track & QR CODE)
    // --------------------------------------------------
    const plateX = bandX + 14;
    const plateY = bandY + 12;
    const plateW = 152;
    const plateH = bandH - 24;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(plateX, plateY, plateW, plateH, 14);
    ctx.fill();
    ctx.stroke();

    // Title: "H2S-Track"
    ctx.fillStyle = '#000000';
    ctx.font = '900 22px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText('H2S-Track', plateX + 12, plateY + 28);

    // QR Code Placement
    const qrSize = 52;
    const qrX = plateX + 12;
    const qrY = plateY + 38;

    this.drawRealisticQrCode(ctx, qrX, qrY, qrSize);

    // Batch ID Text (Right of QR code inside white plate)
    ctx.fillStyle = '#333333';
    ctx.font = '500 8.5px monospace, sans-serif';
    ctx.fillText(`H2S-Batch:${batchId}`, qrX + qrSize + 6, qrY + qrSize - 4);

    // --------------------------------------------------
    // 3. CENTRAL REACTIVE SENSOR PATCH & 4 ARUCO MARKERS
    // --------------------------------------------------
    const patchX = plateX + plateW + 32;
    const patchY = bandY + 16;
    const patchW = 112;
    const patchH = 92;

    // 4 Corner ArUco / Fiducial Markers (DICT_4X4_50 binary matrix grid)
    const markerSize = 11;
    const fiducials = [
      { x: patchX - markerSize - 3, y: patchY - markerSize - 3 }, // Top-Left
      { x: patchX + patchW + 3,     y: patchY - markerSize - 3 }, // Top-Right
      { x: patchX - markerSize - 3, y: patchY + patchH + 3 },     // Bottom-Left
      { x: patchX + patchW + 3,     y: patchY + patchH + 3 }      // Bottom-Right
    ];

    fiducials.forEach((f, idx) => {
      // Black outer frame
      ctx.fillStyle = '#000000';
      ctx.fillRect(f.x, f.y, markerSize, markerSize);

      // White inner border
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(f.x + 1.5, f.y + 1.5, markerSize - 3, markerSize - 3);

      // Distinct binary pattern bits
      ctx.fillStyle = '#000000';
      if (idx === 0) {
        ctx.fillRect(f.x + 3.5, f.y + 3.5, 4, 4);
      } else if (idx === 1) {
        ctx.fillRect(f.x + 3.5, f.y + 3.5, 2, 4);
        ctx.fillRect(f.x + 5.5, f.y + 5.5, 2, 2);
      } else if (idx === 2) {
        ctx.fillRect(f.x + 4, f.y + 3.5, 3, 3);
      } else {
        ctx.fillRect(f.x + 3.5, f.y + 4, 4, 3);
      }
    });

    // Main Chemical Reactive Sensor Window
    const sensorRgb = ColorimetryEngine.getSimulatedSensorRgb(dosePpmH);
    const sensorHex = ColorimetryEngine.rgbToHex(sensorRgb);

    ctx.fillStyle = sensorHex;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(patchX, patchY, patchW, patchH, 12);
    ctx.fill();
    ctx.stroke();

    // Text below patch: "Exposure Scale (H2-S)"
    ctx.fillStyle = '#111111';
    ctx.font = '600 7.5px Inter, system-ui, sans-serif';
    ctx.fillText('Exposure Scale (H2-S)', patchX + 11, patchY + patchH + 14);

    // --------------------------------------------------
    // 4. VERTICAL REFERENCE SCALE (5 Calibrated Swatches)
    // --------------------------------------------------
    const refX = patchX + patchW + 22;
    const refY = patchY;
    const refW = 16;
    const refH = patchH;

    const refColors = ['#F4F8F4', '#DFE7DE', '#B8C3B5', '#685E53', '#262320'];
    const swatchH = refH / refColors.length;

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#111111';

    refColors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(refX, refY + i * swatchH, refW, swatchH);
      ctx.strokeRect(refX, refY + i * swatchH, refW, swatchH);
    });

    // --------------------------------------------------
    // 5. EXPIRY STATUS INDICATORS (Valid, Expired, Over-Expired)
    // --------------------------------------------------
    const statusTextX = refX + refW + 28;
    const statusBoxX = statusTextX + 26;
    const statusY = refY + 4;
    const boxW = 14;
    const boxH = 20;

    const statusList = [
      { text: 'Valid', color: '#E3EAE5' },
      { text: 'Expired', color: '#9E9E9E' },
      { text: 'Over-Expired', color: '#3E3E3E' }
    ];

    ctx.font = '600 8.5px Inter, system-ui, sans-serif';

    statusList.forEach((s, idx) => {
      const cy = statusY + idx * 26;
      ctx.fillStyle = '#111111';
      ctx.fillText(s.text, statusTextX - 18, cy + 13);

      ctx.fillStyle = s.color;
      ctx.fillRect(statusBoxX, cy, boxW, boxH);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(statusBoxX, cy, boxW, boxH);
    });

    // --------------------------------------------------
    // 6. FAR-RIGHT CIRCULAR HERMETIC SEAL
    // --------------------------------------------------
    const circleRadius = 36;
    const circleX = statusBoxX + boxW + 46;
    const circleY = patchY + patchH / 2;

    // Outer Dark Grey Circle
    ctx.fillStyle = '#5B5D5C';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner White/Grey Square
    const sqSize = 34;
    ctx.fillStyle = isExpired ? '#3E3E3E' : '#DDE4DF';
    ctx.fillRect(circleX - sqSize / 2, circleY - sqSize / 2, sqSize, sqSize);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.strokeRect(circleX - sqSize / 2, circleY - sqSize / 2, sqSize, sqSize);
  }

  /**
   * Render a crisp, realistic 2D QR code matrix with finder patterns
   */
  static drawRealisticQrCode(ctx, x, y, size) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = '#000000';
    // 3 Finder Patterns (Top-Left, Top-Right, Bottom-Left)
    this.drawFinderPattern(ctx, x + 2, y + 2, 13);
    this.drawFinderPattern(ctx, x + size - 15, y + 2, 13);
    this.drawFinderPattern(ctx, x + 2, y + size - 15, 13);

    // Realistic QR matrix bit grid
    const step = 3.2;
    const qrMatrix = [
      [0,0,0,0,0,0,0,1,0,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,1,0,1,1,0,0,0,0,0,0],
      [1,0,1,1,0,1,0,0,1,0,1,0,1,1,0,1,0],
      [0,1,0,0,1,0,1,1,0,1,0,1,0,0,1,0,1],
      [1,1,0,1,0,1,0,0,1,0,1,1,0,1,0,1,0],
      [0,0,1,0,1,0,1,1,0,1,0,0,1,0,1,1,0],
      [1,0,0,1,0,1,0,0,0,0,1,0,0,1,0,0,1],
      [0,1,1,0,1,0,1,1,0,1,0,1,1,0,1,0,0],
      [1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1,1],
      [0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0]
    ];

    for (let r = 0; r < qrMatrix.length; r++) {
      for (let c = 0; c < qrMatrix[r].length; c++) {
        if (qrMatrix[r][c] === 1) {
          ctx.fillRect(x + 3 + c * step, y + 3 + r * step, step - 0.4, step - 0.4);
        }
      }
    }

    // Center icon badge mark inside QR code
    const cx = x + size / 2;
    const cy = y + size / 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  static drawFinderPattern(ctx, x, y, size) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 3.8, y + 3.8, size - 7.6, size - 7.6);
  }
}
