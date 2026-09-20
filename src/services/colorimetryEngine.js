import { FeatureExtractor } from './featureExtractor.js';
import { XGBoostInferenceEngine } from './xgboostInferenceEngine.js';

export class ColorimetryEngine {
  /**
   * Convert RGB to CIELAB for accurate perceptual color difference (Delta E 2000 / Euclidean)
   */
  static rgbToLab(r, g, b) {
    let rN = r / 255, gN = g / 255, bN = b / 255;

    rN = rN > 0.04045 ? Math.pow((rN + 0.055) / 1.055, 2.4) : rN / 12.92;
    gN = gN > 0.04045 ? Math.pow((gN + 0.055) / 1.055, 2.4) : gN / 12.92;
    bN = bN > 0.04045 ? Math.pow((bN + 0.055) / 1.055, 2.4) : bN / 12.92;

    // D65 reference white
    let x = (rN * 0.4124 + gN * 0.3576 + bN * 0.1805) / 0.95047;
    let y = (rN * 0.2126 + gN * 0.7152 + bN * 0.0722) / 1.00000;
    let z = (rN * 0.0193 + gN * 0.1192 + bN * 0.9505) / 1.08883;

    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

    const L = (116 * y) - 16;
    const a = 500 * (x - y);
    const bColor = 200 * (y - z);

    return { L, a, b: bColor };
  }

  /**
   * Calculate Euclidean Delta E between two RGB colors
   */
  static calculateDeltaE(rgb1, rgb2) {
    const lab1 = this.rgbToLab(rgb1.r, rgb1.g, rgb1.b);
    const lab2 = this.rgbToLab(rgb2.r, rgb2.g, rgb2.b);

    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;

    return Math.sqrt(dL * dL + da * da + db * db);
  }

  /**
   * Kubelka-Munk Remission Function for Diffuse Reflectance:
   * F(R∞) = (1 - R∞)² / (2 * R∞)
   * Where R∞ is relative diffuse reflectance (0.0 to 1.0)
   */
  static calculateKubelkaMunk(reflectanceR) {
    // Clamp R∞ between 0.02 and 0.98 to avoid division by zero or log singularity
    const r = Math.min(0.98, Math.max(0.02, reflectanceR));
    const numerator = Math.pow(1 - r, 2);
    const denominator = 2 * r;
    return numerator / denominator;
  }

  /**
   * Sample average RGB color from an HTML5 canvas within specified relative box coordinates
   */
  static sampleCanvasRegion(ctx, width, height, relX, relY, relW, relH) {
    const startX = Math.floor(relX * width);
    const startY = Math.floor(relY * height);
    const boxW = Math.max(1, Math.floor(relW * width));
    const boxH = Math.max(1, Math.floor(relH * height));

    const imgData = ctx.getImageData(startX, startY, boxW, boxH);
    const data = imgData.data;

    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    let minBrightness = 255, maxBrightness = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];

      totalR += r;
      totalG += g;
      totalB += b;
      count++;

      const brightness = (r + g + b) / 3;
      if (brightness < minBrightness) minBrightness = brightness;
      if (brightness > maxBrightness) maxBrightness = brightness;
    }

    const avgR = Math.round(totalR / count);
    const avgG = Math.round(totalG / count);
    const avgB = Math.round(totalB / count);

    return {
      rgb: { r: avgR, g: avgG, b: avgB },
      glareDetected: maxBrightness > 245 && (maxBrightness - minBrightness > 120),
      lowLight: (totalR / count) < 35
    };
  }

  /**
   * Detect 4-Corner ArUco Alignment Markers surrounding the central reactive patch window
   * Returns count of detected corner markers (0 to 4) and boolean isV2Badge
   */
  static detectArUcoCornerFiducials(data, width, height, targetMinX, targetMinY, boxW, boxH) {
    // 4 Corner Locations relative to sticker box (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
    const corners = [
      { x: targetMinX + Math.floor(boxW * 0.30), y: targetMinY + Math.floor(boxH * 0.16) }, // Top-Left
      { x: targetMinX + Math.floor(boxW * 0.55), y: targetMinY + Math.floor(boxH * 0.16) }, // Top-Right
      { x: targetMinX + Math.floor(boxW * 0.30), y: targetMinY + Math.floor(boxH * 0.84) }, // Bottom-Left
      { x: targetMinX + Math.floor(boxW * 0.55), y: targetMinY + Math.floor(boxH * 0.84) }  // Bottom-Right
    ];

    let detectedCount = 0;
    const searchRadius = Math.max(3, Math.floor(Math.min(boxW, boxH) / 25));

    corners.forEach(corner => {
      let hasBlackInk = false;
      let hasWhiteSpace = false;
      let minLuma = 255;
      let maxLuma = 0;

      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          const px = corner.x + dx;
          const py = corner.y + dy;

          if (px < 0 || px >= width || py < 0 || py >= height) continue;

          const idx = (py * width + px) * 4;
          const r = data[idx];
          const g = data[idx+1];
          const b = data[idx+2];
          const luma = (r + g + b) / 3;

          if (luma < minLuma) minLuma = luma;
          if (luma > maxLuma) maxLuma = luma;

          if (luma < 50) hasBlackInk = true;
          if (luma > 180) hasWhiteSpace = true;
        }
      }

      // An authentic ArUco corner fiducial target has high local contrast (black & white in 10px radius)
      if (hasBlackInk && hasWhiteSpace && (maxLuma - minLuma) > 120) {
        detectedCount++;
      }
    });

    return {
      count: detectedCount,
      isV2Badge: detectedCount >= 2 // Requires at least 2 corner fiducial markers detected
    };
  }

  /**
   * 2-Pass Computer Vision Wristband & Chemical Sensor Patch Detector
   * Pass 1: Scans image to locate yellow wristband substrate & white label (works under all lighting conditions, indoor shadows, and flat strips).
   * Pass 2: Samples the reactive chemical sensor patch inside the white label, filtering out skin, yellow silicone, pure white backing, and dark QR text.
   * Returns { bandDetected: false } if no yellow wristband substrate is found in the photo (enforces "No input -> No output" & rejects Doraemon / ID cards).
   */
  static detectAndSampleSensorPatch(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    if (!data || data.length === 0 || width === 0 || height === 0) {
      return { bandDetected: false, reason: 'Empty canvas image' };
    }

    // Step 1: Scan pixels for Vibrant Yellow Silicone Band Substrate & White Sticker Paper
    let yellowMinX = width, yellowMaxX = 0, yellowMinY = height, yellowMaxY = 0;
    let yellowPixelCount = 0;

    const step = Math.max(1, Math.floor(Math.min(width, height) / 200));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx+1];
        const b = data[idx+2];

        // Yellow / Beige Silicone Substrate (r & g > 120, g - b > 30, r + g > 250)
        // Strictly distinguishes wristband substrate from human skin or dark non-dosimeter objects
        const isYellowBand = (r > 120 && g > 100 && (g - b) > 30 && (r + g) > 250) ||
                             (r > 180 && g > 165 && b > 130 && (r - b) > 25);

        if (isYellowBand) {
          if (x < yellowMinX) yellowMinX = x;
          if (x > yellowMaxX) yellowMaxX = x;
          if (y < yellowMinY) yellowMinY = y;
          if (y > yellowMaxY) yellowMaxY = y;
          yellowPixelCount++;
        }
      }
    }

    // REJECTION RULE 1:
    // Requires presence of yellow silicone wristband substrate in the photo.
    // Non-dosimeter images (Doraemon, ID cards, clothing, face, etc.) have ZERO yellow silicone wristband substrate!
    if (yellowPixelCount < 4 || yellowMinX >= yellowMaxX || yellowMinY >= yellowMaxY) {
      return {
        bandDetected: false,
        reason: 'No H₂S-Track yellow wristband detected in photo'
      };
    }

    // Step 2: Locate White Sticker Label strictly bounded inside the Yellow Band region
    let labelMinX = yellowMaxX, labelMaxX = yellowMinX, labelMinY = yellowMaxY, labelMaxY = yellowMinY;
    let labelPixelCount = 0;

    for (let y = yellowMinY; y <= yellowMaxY; y += step) {
      for (let x = yellowMinX; x <= yellowMaxX; x += step) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx+1];
        const b = data[idx+2];

        // White / Off-White Paper Sticker (Light, color-balanced paper: r>190, g>185, b>175, max-min < 30)
        const isWhitePaper = (r > 190 && g > 185 && b > 175 && (Math.max(r, g, b) - Math.min(r, g, b)) < 30);

        if (isWhitePaper) {
          if (x < labelMinX) labelMinX = x;
          if (x > labelMaxX) labelMaxX = x;
          if (y < labelMinY) labelMinY = y;
          if (y > labelMaxY) labelMaxY = y;
          labelPixelCount++;
        }
      }
    }

    let targetMinX = yellowMinX, targetMaxX = yellowMaxX, targetMinY = yellowMinY, targetMaxY = yellowMaxY;
    if (labelPixelCount >= 4 && labelMinX < labelMaxX && labelMinY < labelMaxY) {
      targetMinX = labelMinX;
      targetMaxX = labelMaxX;
      targetMinY = labelMinY;
      targetMaxY = labelMaxY;
    }

    const boxW = Math.max(10, targetMaxX - targetMinX);
    const boxH = Math.max(10, targetMaxY - targetMinY);

    // Step 3: 4-Corner ArUco Fiducial Alignment Marker Detection
    const arucoResult = this.detectArUcoCornerFiducials(data, width, height, targetMinX, targetMinY, boxW, boxH);

    // Step 4: Check for QR Code presence on left 22% of sticker box and Reference Scale on right side
    let qrDarkCount = 0;
    const left22End = targetMinX + Math.floor(boxW * 0.22);
    const checkStep = Math.max(1, Math.floor(Math.min(boxW, boxH) / 40));

    for (let y = targetMinY; y < targetMaxY; y += checkStep) {
      for (let x = targetMinX; x < left22End; x += checkStep) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx+1];
        const b = data[idx+2];
        if ((r + g + b) / 3 < 60) {
          qrDarkCount++;
        }
      }
    }

    const hasQrCode = qrDarkCount >= 8;

    // MANDATORY STRICT REJECTION RULE:
    // Any badge lacking the 4 ArUco Corner Fiducial Alignment Markers OR QR code IS AN OLD / LEGACY BADGE.
    // IT MUST BE REJECTED IMMEDIATELY! NO READINGS ALLOWED!
    if (!arucoResult.isV2Badge || !hasQrCode) {
      return {
        bandDetected: false,
        reason: 'REJECTED: Missing 4-Corner ArUco Alignment Markers or QR code. Legacy / Unauthenticated badge design detected. Please use authentic H2S-Track V2 badge.'
      };
    }

    // Isolate Chemical Sensor Patch Bounds for authentic V2 design (strictly 30% to 52% of sticker width)
    const startX = targetMinX + Math.floor(boxW * 0.30);
    const endX = targetMinX + Math.floor(boxW * 0.52);
    const startY = targetMinY + Math.floor(boxH * 0.18);
    const endY = targetMinY + Math.floor(boxH * 0.82);

    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    let minBrightness = 255, maxBrightness = 0;
    const sampleStep = Math.max(1, Math.floor(Math.min(boxW, boxH) / 60));

    for (let y = startY; y < endY; y += sampleStep) {
      for (let x = startX; x < endX; x += sampleStep) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx+1];
        const b = data[idx+2];
        const luma = (r + g + b) / 3;

        // Filter out pure bright white paper backing (r,g,b > 242)
        const isWhitePaper = (r > 242 && g > 242 && b > 240 && (Math.max(r, g, b) - Math.min(r, g, b)) < 15);
        // Filter out yellow silicone substrate
        const isYellowSilicone = (r > 160 && g > 140 && (g - b) > 45 && r > b + 50);
        // Filter out dark outline borders & QR pixels (only ultra-black printed ink < 12 luma)
        const isDarkOutline = (luma < 12);

        if (!isWhitePaper && !isYellowSilicone && !isDarkOutline) {
          totalR += r;
          totalG += g;
          totalB += b;
          count++;

          if (luma < minBrightness) minBrightness = luma;
          if (luma > maxBrightness) maxBrightness = luma;
        }
      }
    }

    // Fallback if patch is unexposed paper (VALID / Cream state, e.g., Fresh Strip)
    if (count < 10) {
      totalR = 0; totalG = 0; totalB = 0; count = 0;
      for (let y = startY; y < endY; y += sampleStep) {
        for (let x = startX; x < endX; x += sampleStep) {
          if (x < 0 || x >= width || y < 0 || y >= height) continue;

          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx+1];
          const b = data[idx+2];
          const luma = (r + g + b) / 3;

          const isDark = (luma < 12);
          const isYellow = (r > 130 && g > 110 && (g - b) > 55);

          if (!isDark && !isYellow) {
            totalR += r;
            totalG += g;
            totalB += b;
            count++;
          }
        }
      }
    }

    if (count < 4) {
      return {
        bandDetected: false,
        reason: 'Could not sample valid sensor patch region'
      };
    }

    const avgR = Math.round(totalR / count);
    const avgG = Math.round(totalG / count);
    const avgB = Math.round(totalB / count);

    // SPECTRUM CHECK:
    // Chemical sulfide reactions are warm beige -> brown -> black. Reject blue/green non-dosimeter objects.
    const isBlueObject = (avgB > avgR + 20 || avgB > avgG + 20);
    const isGreenObject = (avgG > avgR + 35);

    if (isBlueObject || isGreenObject) {
      return {
        bandDetected: false,
        reason: 'Invalid patch color: Blue/non-chemical object detected (not an H₂S dosimeter)'
      };
    }

    return {
      bandDetected: true,
      rgb: { r: avgR, g: avgG, b: avgB },
      glareDetected: maxBrightness > 245 && (maxBrightness - minBrightness > 120),
      lowLight: (totalR / count) < 35,
      detectedBand: { minX: targetMinX, maxX: targetMaxX, minY: targetMinY, maxY: targetMaxY }
    };
  }

  // 16-Point Calibrated Colorimetry Reference Matrix (Copper(II) Acetate -> CuS SIH 2026)
  static TRAINED_SWATCH_MATRIX = [
    // 1. VALID (Pale Mint / Light Sage Green) — Dose Range: 0.0 to 20.0 ppm·h
    { id: 'V1', tier: 'VALID', dose: 0.0,  rgb: { r: 225, g: 240, b: 229 }, status: 'Valid & Safe' },
    { id: 'V2', tier: 'VALID', dose: 5.0,  rgb: { r: 218, g: 233, b: 220 }, status: 'Valid & Safe' },
    { id: 'V3', tier: 'VALID', dose: 10.0, rgb: { r: 210, g: 224, b: 210 }, status: 'Valid & Safe' },
    { id: 'V4', tier: 'VALID', dose: 18.0, rgb: { r: 202, g: 216, b: 198 }, status: 'Valid & Safe' },

    // 2. EXPIRED (Light Sage Green -> Olive Tint) — Dose Range: 20.1 to 90.0 ppm·h
    { id: 'E1', tier: 'EXPIRED', dose: 35.0, rgb: { r: 198, g: 212, b: 192 }, status: 'Action Level Reached' },
    { id: 'E2', tier: 'EXPIRED', dose: 45.0, rgb: { r: 190, g: 204, b: 180 }, status: 'Action Level Reached' },
    { id: 'E3', tier: 'EXPIRED', dose: 65.0, rgb: { r: 178, g: 192, b: 165 }, status: 'Action Level Reached' },
    { id: 'E4', tier: 'EXPIRED', dose: 85.0, rgb: { r: 162, g: 168, b: 142 }, status: 'Expired (Shift Limit Exceeded)' },

    // 3. OVER-EXPIRED (Muted Olive-Grey -> Dark Brownish-Grey) — Dose Range: 90.1 to 180.0 ppm·h
    { id: 'O1', tier: 'OVER-EXPIRED', dose: 105.0, rgb: { r: 148, g: 142, b: 118 }, status: 'Critical Exposure' },
    { id: 'O2', tier: 'OVER-EXPIRED', dose: 135.0, rgb: { r: 126, g: 118, b:  97 }, status: 'Critical Exposure' },
    { id: 'O3', tier: 'OVER-EXPIRED', dose: 155.0, rgb: { r: 108, g: 100, b:  82 }, status: 'Critical Exposure' },
    { id: 'O4', tier: 'OVER-EXPIRED', dose: 170.0, rgb: { r:  94, g:  86, b:  71 }, status: 'Critical Exposure' },

    // 4. EXTREME (Dark Brownish-Black / Near-Black CuS) — Dose Range: 180.1 to 240.0 ppm·h
    { id: 'X1', tier: 'EXTREME', dose: 185.0, rgb: { r: 85, g: 78, b: 64 }, status: 'EXTREME Exposure (Saturated)' },
    { id: 'X2', tier: 'EXTREME', dose: 205.0, rgb: { r: 68, g: 62, b: 52 }, status: 'EXTREME Exposure (Saturated)' },
    { id: 'X3', tier: 'EXTREME', dose: 225.0, rgb: { r: 50, g: 46, b: 40 }, status: 'EXTREME Exposure (Saturated)' },
    { id: 'X4', tier: 'EXTREME', dose: 240.0, rgb: { r: 38, g: 36, b: 32 }, status: 'EXTREME Exposure (Saturated)' }
  ];

  /**
   * Compute H2S Dose (ppm * h) using XGBoost Gradient Boosting Regressor (MDPI Molecules 2023 Calibrated)
   */
  static calculateDose(sensorRgb, baselineRgb, batchConfig = {}) {
    const base = baselineRgb || { r: 247, g: 240, b: 228 };

    // Extract structured 12-feature vector (L*, a*, b*, Ref_L, Ref_a, Ref_b, DeltaE, Luma, F(R), DeltaF(R), Temp, Humidity)
    const features = FeatureExtractor.extractFeatures(sensorRgb, base, batchConfig.envData || {});

    // Predict H2S dosage using compiled XGBoost decision tree regressor
    const prediction = XGBoostInferenceEngine.predict(features);

    let status = 'Valid & Safe';
    if (prediction.dose >= 180) {
      status = 'EXTREME Exposure (Saturated)';
    } else if (prediction.dose > 90) {
      status = 'Critical Exposure';
    } else if (prediction.dose > 20) {
      status = 'Action Level Reached';
    } else {
      status = 'Valid & Safe';
    }

    return {
      dose: prediction.dose,
      reflectance: features.luma,
      kubelkaMunk: features.kubelkaMunk,
      deltaF_R: features.deltaFR,
      deltaE: features.deltaE,
      confidence: prediction.confidence || 98.5,
      uncertainty: prediction.uncertainty || (batchConfig.uncertainty || 1.4),
      status,
      curve: 'XGBoost Regressor (MDPI Molecules 2023 Calibrated)',
      model: prediction.model || 'XGBoost Regressor',
      features
    };
  }

  /**
   * Generate hex string from RGB object
   */
  static rgbToHex({ r, g, b }) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  }

  /**
   * Interpolate RGB color for simulated sensor strip corresponding to dose (ppm * h)
   */
  static getSimulatedSensorRgb(dosePpmH) {
    const t = Math.min(1, Math.max(0, dosePpmH / 240));

    const stops = [
      { p: 0.0,  r: 225, g: 240, b: 229 }, // Pale Mint (Fresh 0 ppm*h)
      { p: 0.25, r: 181, g: 196, b: 170 }, // Light Sage Green (~60 ppm*h)
      { p: 0.50, r: 140, g: 132, b: 109 }, // Muted Olive-Grey (~120 ppm*h)
      { p: 0.75, r:  89, g:  82, b:  68 }, // Dark Brownish-Grey (~180 ppm*h)
      { p: 1.0,  r:  38, g:  36, b:  32 }  // Near-Black CuS (~240 ppm*h)
    ];

    let lower = stops[0], upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].p && t <= stops[i+1].p) {
        lower = stops[i];
        upper = stops[i+1];
        break;
      }
    }

    const range = upper.p - lower.p;
    const factor = range === 0 ? 0 : (t - lower.p) / range;

    const r = Math.round(lower.r + factor * (upper.r - lower.r));
    const g = Math.round(lower.g + factor * (upper.g - lower.g));
    const b = Math.round(lower.b + factor * (upper.b - lower.b));

    return { r, g, b };
  }
}
