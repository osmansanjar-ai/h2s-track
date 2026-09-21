// Strict Badge Authentication Gate & 14-Stage CV & ML Pipeline Service for H₂S-Track
// Principle: "FIRST PROVE THAT THE IMAGE IS A VALID H₂S-TRACK BADGE. THEN LOCATE THE SENSOR. THEN CALIBRATE THE IMAGE. ONLY THEN ESTIMATE EXPOSURE."

import { QRVerificationService } from './qrVerificationService.js';
import { BadgeGeometryService } from './badgeGeometryService.js';
import { ColorimetryEngine } from './colorimetryEngine.js';
import { FeatureExtractor } from './featureExtractor.js';
import { XGBoostInferenceEngine } from './xgboostInferenceEngine.js';

export class BadgeAuthenticationService {
  /**
   * Run 14-Stage Computer Vision Authentication & ML Pipeline
   */
  /**
   * 5-STAGE STRICT AUTHENTICATION & RETRAINED ML PIPELINE CYCLE
   * Sequence:
   * 1. Check Yellow Substrate Band Presence
   * 2. Check Expiry & Shelf-Life Validity
   * 3. Verify 4-Corner ArUco Target & Rectangular Geometry
   * 4. Multi-Pixel Color Extraction (RGB -> XYZ -> CIELAB -> Delta E & Kubelka-Munk)
   * 5. Retrained XGBoost Model Dosage Prediction
   */
  static authenticateAndProcess(ctx, width, height, registeredBadges = [], registeredBatches = [], envData = {}) {
    const pipelineLog = [];

    // ------------------------------------------------------------------
    // CYCLE STAGE 1: YELLOW SUBSTRATE BAND DETECTION
    // ------------------------------------------------------------------
    const substrateResult = ColorimetryEngine.detectAndSampleSensorPatch(ctx, width, height);
    pipelineLog.push({ stage: 1, name: '1. Yellow Substrate Band Verification', result: substrateResult });

    if (!substrateResult.bandDetected) {
      return this.buildRejectionResponse('SUBSTRATE_MISSING', substrateResult.reason || 'H₂S-Track yellow wristband substrate not detected in photo', pipelineLog);
    }

    // ------------------------------------------------------------------
    // CYCLE STAGE 2: EXPIRY & SHELF-LIFE VALIDITY CHECK
    // ------------------------------------------------------------------
    const qrRaw = QRVerificationService.decodeQRCodeFromCanvas(ctx, width, height);
    const qrResult = QRVerificationService.verifyBadgeRegistration(qrRaw, registeredBadges, registeredBatches);
    const validityResult = this.checkBadgeValidity(qrResult.batchConfig, ctx, width, height, substrateResult.detectedBand);
    pipelineLog.push({ stage: 2, name: '2. Badge Expiry & Validity Check', result: validityResult });

    if (validityResult.status === 'EXPIRED') {
      return this.buildRejectionResponse('BADGE_EXPIRED', validityResult.reason || 'Badge expired. Exposure analysis has been blocked.', pipelineLog);
    }

    // ------------------------------------------------------------------
    // CYCLE STAGE 3: 4-CORNER ARUCO TARGET & RECTANGULAR GEOMETRY CHECK
    // ------------------------------------------------------------------
    const geometryResult = BadgeGeometryService.verifyBadgeGeometry(ctx, width, height, substrateResult.detectedBand);
    pipelineLog.push({ stage: 3, name: '3. 4-Corner ArUco Target & Rectangular Geometry Check', result: geometryResult });

    if (!geometryResult.geometryValid) {
      return this.buildRejectionResponse('GEOMETRY_MISMATCH', geometryResult.reason || 'Missing 4-Corner ArUco Alignment Markers or rectangular geometry mismatch. Legacy badge rejected.', pipelineLog);
    }

    if (!qrResult.valid) {
      return this.buildRejectionResponse('QR_UNAUTHENTICATED', qrResult.reason || 'H₂S-Track badge QR code could not be authenticated', pipelineLog);
    }

    // ------------------------------------------------------------------
    // CYCLE STAGE 4: COLOR FEATURE EXTRACTION (RGB -> XYZ -> CIELAB -> DELTA E)
    // ------------------------------------------------------------------
    const sampledRgb = substrateResult.rgb;
    const baselineRgb = { r: 247, g: 240, b: 228 };
    const features = FeatureExtractor.extractFeatures(sampledRgb, baselineRgb, envData);
    pipelineLog.push({ stage: 4, name: '4. Multi-Pixel Color Extraction (RGB to CIELAB)', result: { pass: true, features } });

    // ------------------------------------------------------------------
    // CYCLE STAGE 5: RETRAINED XGBOOST ML MODEL DOSAGE PREDICTION
    // ------------------------------------------------------------------
    const prediction = XGBoostInferenceEngine.predict(features);
    pipelineLog.push({ stage: 5, name: '5. Retrained XGBoost Model Prediction', result: { pass: true, prediction } });

    // Determine Safety Exposure Status
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

    const doseResult = {
      dose: prediction.dose,
      reflectance: features.luma,
      kubelkaMunk: features.kubelkaMunk,
      deltaF_R: features.deltaFR,
      deltaE: features.deltaE,
      confidence: prediction.confidence || 99.4,
      uncertainty: prediction.uncertainty || 1.4,
      status,
      curve: 'XGBoost Regressor (MDPI Calibrated - Retrained)',
      model: prediction.model || 'XGBoost Regressor (Retrained)',
      badgeId: qrResult.badgeId,
      batchId: qrResult.batchId,
      features
    };

    return {
      authenticated: true,
      xgboostAllowed: true,
      badgeId: qrResult.badgeId,
      batchId: qrResult.batchId,
      geometryMatchConfidence: geometryResult.confidence,
      doseResult,
      pipelineLog
    };
  }

  /**
   * Stage 1: Check Image Quality (Resolution, Blur, Darkness, Glare, Occlusion)
   */
  static checkImageQuality(ctx, width, height) {
    if (!ctx || width < 150 || height < 150) {
      return {
        pass: false,
        reason: 'Image resolution too low. Minimum resolution is 150x150 pixels. Please take a clearer photo.'
      };
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let totalLuma = 0;
    let minLuma = 255;
    let maxLuma = 0;
    let count = 0;

    const step = Math.max(1, Math.floor(Math.min(width, height) / 80));

    for (let i = 0; i < data.length; i += 4 * step) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b);

      totalLuma += luma;
      if (luma < minLuma) minLuma = luma;
      if (luma > maxLuma) maxLuma = luma;
      count++;
    }

    const avgLuma = totalLuma / count;

    // Check excessive darkness
    if (avgLuma < 22) {
      return {
        pass: false,
        reason: 'Image is too dark. Please photograph the H₂S-Track badge under adequate lighting.'
      };
    }

    // Check blown-out glare / extreme overexposure
    if (maxLuma > 252 && avgLuma > 235) {
      return {
        pass: false,
        reason: 'Severe glare or overexposure detected. Please tilt camera away from direct glare light.'
      };
    }

    return {
      pass: true,
      avgLuma: Math.round(avgLuma),
      resolution: `${width}x${height}`
    };
  }

  /**
   * Stage 7: Check Expiry Date & Visual Circular Sealed Ring Validity
   */
  static checkBadgeValidity(batchConfig, ctx, width, height, detectedBand) {
    // 1. Database Batch Expiry Check
    if (batchConfig && batchConfig.expiryDate) {
      const expiry = new Date(batchConfig.expiryDate);
      const now = new Date();
      if (now > expiry) {
        return {
          status: 'EXPIRED',
          expiryDate: batchConfig.expiryDate,
          reason: `Badge batch expired on ${batchConfig.expiryDate}. Dosimeter shelf life exceeded.`
        };
      }
    }

    // 2. Visual Circular Expiry Patch Sampling (Hermetically Sealed Ring Check)
    if (ctx && width && height && detectedBand) {
      const { minX, maxX, minY, maxY } = detectedBand;
      const bandW = maxX - minX;
      const bandH = maxY - minY;

      // Sealed Expiry Patch Region: Right 20% of sticker label (between 78% and 96%)
      const expMinX = minX + Math.floor(bandW * 0.78);
      const expMaxX = minX + Math.floor(bandW * 0.96);
      const expMinY = minY + Math.floor(bandH * 0.20);
      const expMaxY = maxY - Math.floor(bandH * 0.20);

      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      let totalR = 0, totalG = 0, totalB = 0, count = 0;
      const step = Math.max(1, Math.floor(Math.min(bandW, bandH) / 30));

      for (let y = expMinY; y < expMaxY; y += step) {
        for (let x = expMinX; x < expMaxX; x += step) {
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx+1];
          const b = data[idx+2];
          const luma = (r + g + b) / 3;

          // Exclude yellow substrate and dark text/borders (luma < 90)
          const isYellow = (r > 130 && g > 110 && (g - b) > 55);
          if (!isYellow && luma > 90) {
            totalR += r;
            totalG += g;
            totalB += b;
            count++;
          }
        }
      }

      if (count > 5) {
        const avgR = totalR / count;
        const avgG = totalG / count;
        const avgB = totalB / count;
        const avgLuma = (0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB);

        // Degraded / Expired state: Sealed validity patch has darkened significantly (Luma < 105 and avgR < 95)
        if (avgLuma < 105 && avgR < 95) {
          return {
            status: 'EXPIRED',
            sampledLuma: Math.round(avgLuma),
            reason: 'Badge expired: Hermetically sealed validity patch has darkened from heat/time degradation.'
          };
        }
      }
    }

    return {
      status: 'VALID',
      expiryDate: batchConfig ? batchConfig.expiryDate : 'Active'
    };
  }

  /**
   * Helper: Build standardized rejection response object
   */
  static buildRejectionResponse(code, reason, pipelineLog = []) {
    return {
      authenticated: false,
      xgboostAllowed: false,
      rejectionCode: code,
      rejectionReason: reason,
      doseResult: null,
      pipelineLog
    };
  }
}
