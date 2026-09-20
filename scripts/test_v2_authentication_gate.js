// Acceptance Test Suite for H₂S-Track V2 Strict Badge Authentication Gate (SIH 2026 Copper(II) Acetate Palette)
// Verifies 9 Mandatory Acceptance Test Cases (A through I)

import { BadgeAuthenticationService } from '../src/services/badgeAuthenticationService.js';
import { db } from '../server/db.js';

console.log('===========================================================');
console.log(' H₂S-TRACK V2: SIH 2026 COPPER ACETATE & VISUAL EXPIRY GATE');
console.log('===========================================================');

const registeredBadges = db.getBadges();
const registeredBatches = db.getBatches();

// Mock canvas helper
function createMockCanvas(width, height, drawFn) {
  const canvas = {
    width,
    height,
    getContext: () => ({
      canvas: { width, height },
      getImageData: (x, y, w, h) => {
        const data = new Uint8ClampedArray(w * h * 4);
        drawFn(data, w, h);
        return { data };
      },
      drawImage: () => {}
    })
  };
  return canvas;
}

const testCases = [
  {
    code: 'A',
    name: 'Random Photograph (Dog / Room / Landscape)',
    draw: (data, w, h) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 100; data[i+1] = 120; data[i+2] = 200; data[i+3] = 255;
      }
    },
    expectedAuth: false
  },
  {
    code: 'B',
    name: 'Photograph of Brown Object (Wood / Coffee Cup)',
    draw: (data, w, h) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 138; data[i+1] = 90; data[i+2] = 42; data[i+3] = 255;
      }
    },
    expectedAuth: false
  },
  {
    code: 'C',
    name: 'Photograph of Color Chart',
    draw: (data, w, h) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (i % 255); data[i+1] = 150; data[i+2] = 80; data[i+3] = 255;
      }
    },
    expectedAuth: false
  },
  {
    code: 'D',
    name: 'Screenshot Containing Reference Scale Alone',
    draw: (data, w, h) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 240; data[i+1] = 230; data[i+2] = 210; data[i+3] = 255;
      }
    },
    expectedAuth: false
  },
  {
    code: 'E',
    name: 'Photograph Containing Only QR Code (No Badge Substrate)',
    draw: (data, w, h) => {
      for (let i = 0; i < data.length; i += 4) {
        const val = (i % 8 === 0) ? 0 : 255;
        data[i] = val; data[i+1] = val; data[i+2] = val; data[i+3] = 255;
      }
    },
    expectedAuth: false
  },
  {
    code: 'F',
    name: 'Partial Badge / Heavily Occluded Substrate',
    draw: (data, w, h) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 50; data[i+1] = 50; data[i+2] = 50; data[i+3] = 255;
      }
      data[0] = 200; data[1] = 180; data[2] = 20;
    },
    expectedAuth: false
  },
  {
    code: 'G',
    name: 'Blurry / Extremely Dark Image (Failed Quality Check)',
    draw: (data, w, h) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 10; data[i+1] = 10; data[i+2] = 10; data[i+3] = 255;
      }
    },
    expectedAuth: false
  },
  {
    code: 'H',
    name: 'Expired H₂S-Track Badge (Darkened Hermetic Expiry Ring)',
    draw: (data, w, h) => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (y > 40 && y < 160 && x > 40 && x < 360) {
            if (x >= 60 && x <= 110 && y >= 60 && y <= 140 && (x + y) % 3 === 0) {
              data[idx] = 15; data[idx+1] = 15; data[idx+2] = 15; data[idx+3] = 255; // QR dark pattern
            } else if (x >= 310 && x <= 345 && y >= 70 && y <= 130) {
              // Darkened / Aged sealed expiry patch (Luma < 125 -> EXPIRED)
              data[idx] = 89; data[idx+1] = 82; data[idx+2] = 68; data[idx+3] = 255;
            } else {
              data[idx] = 245; data[idx+1] = 240; data[idx+2] = 230; data[idx+3] = 255;
            }
          } else {
            data[idx] = 220; data[idx+1] = 180; data[idx+2] = 20; data[idx+3] = 255; // Yellow silicone
          }
        }
      }
    },
    expiredBatch: true,
    expectedAuth: false
  },
  {
    code: 'I',
    name: 'Genuine Complete Active H₂S-Track Badge (Cu-Acetate Chemistry)',
    draw: (data, w, h) => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (y >= 40 && y <= 160 && x >= 50 && x <= 350) {
            // White sticker label
            if (x >= 60 && x <= 110 && y >= 60 && y <= 140 && (x + y) % 3 === 0) {
              // QR dark pattern
              data[idx] = 15; data[idx+1] = 15; data[idx+2] = 15; data[idx+3] = 255;
            } else if (x >= 140 && x <= 220 && y >= 70 && y <= 130) {
              // Copper(II) Acetate Light Sage Green (35.0 ppm*h exposure: R=198, G=212, B=192)
              data[idx] = 198; data[idx+1] = 212; data[idx+2] = 192; data[idx+3] = 255;
            } else if (x >= 310 && x <= 345 && y >= 70 && y <= 130) {
              // Fresh Pale Mint Sealed Expiry Ring (RGB 225, 240, 229 -> VALID)
              data[idx] = 225; data[idx+1] = 240; data[idx+2] = 229; data[idx+3] = 255;
            } else {
              data[idx] = 245; data[idx+1] = 240; data[idx+2] = 230; data[idx+3] = 255;
            }
          } else {
            // Yellow silicone wristband substrate
            data[idx] = 220; data[idx+1] = 180; data[idx+2] = 20; data[idx+3] = 255;
          }
        }
      }
    },
    expectedAuth: true
  }
];

let passedCount = 0;

testCases.forEach(tc => {
  const canvas = createMockCanvas(400, 200, tc.draw);
  const ctx = canvas.getContext('2d');
  
  const batchesToUse = tc.expiredBatch 
    ? [{ batchId: 'H2S-2026-001', expiryDate: '2025-01-01' }]
    : registeredBatches;

  const result = BadgeAuthenticationService.authenticateAndProcess(ctx, canvas.width, canvas.height, registeredBadges, batchesToUse);

  const testPassed = result.authenticated === tc.expectedAuth && result.xgboostAllowed === tc.expectedAuth;
  if (testPassed) passedCount++;

  console.log(`\n[CASE ${tc.code}] ${tc.name}`);
  console.log(`  Expected Auth: ${tc.expectedAuth} | Actual Auth: ${result.authenticated}`);
  console.log(`  XGBoost Allowed: ${result.xgboostAllowed}`);
  if (!result.authenticated) {
    console.log(`  Rejection Reason: "${result.rejectionReason}"`);
  } else {
    console.log(`  Predicted Dose: ${result.doseResult.dose} ppm*h (${result.doseResult.status})`);
    console.log(`  Confidence: ${result.doseResult.confidence}%`);
  }
  console.log(`  Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
});

console.log('\n===========================================================');
console.log(` ACCEPTANCE SUMMARY: ${passedCount} / ${testCases.length} TEST CASES PASSED`);
console.log('===========================================================');
