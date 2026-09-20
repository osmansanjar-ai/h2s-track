// Feature Extraction Engine for XGBoost Gradient Boosting Regressor
// Converts raw sampled sensor patch RGB and baseline white paper into structured numerical feature vectors

import { ColorimetryEngine } from './colorimetryEngine.js';

export class FeatureExtractor {
  /**
   * Extract 12 structured features from sensor RGB, reference baseline RGB, and ambient sensors
   * Output feature vector: [L*, a*, b*, Ref_L, Ref_a, Ref_b, DeltaE, Luma, F(R), DeltaF(R), Temp, Humidity]
   */
  static extractFeatures(sensorRgb, baselineRgb = { r: 247, g: 240, b: 228 }, envData = {}) {
    const sLab = ColorimetryEngine.rgbToLab(sensorRgb.r, sensorRgb.g, sensorRgb.b);
    const bLab = ColorimetryEngine.rgbToLab(baselineRgb.r, baselineRgb.g, baselineRgb.b);

    const deltaE = ColorimetryEngine.calculateDeltaE(sensorRgb, baselineRgb);

    const sensorLuma = (0.2126 * sensorRgb.r + 0.7152 * sensorRgb.g + 0.0722 * sensorRgb.b) / 255.0;
    const baseLuma = (0.2126 * baselineRgb.r + 0.7152 * baselineRgb.g + 0.0722 * baselineRgb.b) / 255.0;

    const rInf = Math.min(0.85, Math.max(0.08, (sensorLuma / baseLuma) * 0.85));
    const kubelkaMunk = ColorimetryEngine.calculateKubelkaMunk(rInf);
    const baseKubelkaMunk = ColorimetryEngine.calculateKubelkaMunk(0.85);
    const deltaFR = Math.max(0, kubelkaMunk - baseKubelkaMunk);

    const temp = envData.temp !== undefined ? envData.temp : 25.0;
    const humidity = envData.humidity !== undefined ? envData.humidity : 55.0;

    return {
      r: sensorRgb.r,
      g: sensorRgb.g,
      b: sensorRgb.b,
      L: Math.round(sLab.L * 100) / 100,
      a: Math.round(sLab.a * 100) / 100,
      bColor: Math.round(sLab.b * 100) / 100,
      refL: Math.round(bLab.L * 100) / 100,
      refA: Math.round(bLab.a * 100) / 100,
      refB: Math.round(bLab.b * 100) / 100,
      deltaE: Math.round(deltaE * 100) / 100,
      luma: Math.round(sensorLuma * 1000) / 1000,
      kubelkaMunk: Math.round(kubelkaMunk * 1000) / 1000,
      deltaFR: Math.round(deltaFR * 1000) / 1000,
      temp,
      humidity,
      vector: [
        sLab.L, sLab.a, sLab.b,
        bLab.L, bLab.a, bLab.b,
        deltaE, sensorLuma, kubelkaMunk, deltaFR,
        temp, humidity
      ]
    };
  }
}
