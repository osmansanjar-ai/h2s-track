import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { FeatureExtractor } from '../src/services/featureExtractor.js';
import { XGBoostInferenceEngine } from '../src/services/xgboostInferenceEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'h2strack_secret_key_2026';

app.use(cors());
app.use(express.json());

// Auth Token Verification Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decodedUser;
    }
    next();
  });
};

app.use(authenticateToken);

// ================= AUTH ROUTES =================

/**
 * POST /api/auth/signup
 * Register a new user with Name, Email, Password, and Role
 */
app.post('/api/auth/signup', (req, res) => {
  try {
    const { name, email, password, role, company, isIndependent, site, unit } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const newUser = db.createUser({
      name,
      email,
      password,
      role: role || 'worker',
      company: company || '',
      isIndependent: Boolean(isIndependent),
      site: site || company || 'Panvel Gas Terminal',
      unit: unit || 'Operations'
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name, company: newUser.company },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account registered successfully',
      token,
      user: newUser
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

/**
 * GET /api/company/pending-requests
 */
app.get('/api/company/pending-requests', (req, res) => {
  const officerCompany = req.user ? req.user.company : '';
  const requests = db.getPendingJoinRequests(officerCompany);
  res.json({ requests });
});

/**
 * POST /api/company/approve
 */
app.post('/api/company/approve', (req, res) => {
  try {
    const { userId } = req.body;
    const user = db.approveJoinRequest(userId);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/company/reject
 */
app.post('/api/company/reject', (req, res) => {
  try {
    const { userId } = req.body;
    const user = db.rejectJoinRequest(userId);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Sign in existing user with email and password
 */
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash, ...userProfile } = user;

    res.json({
      message: 'Signed in successfully',
      token,
      user: userProfile
    });
  } catch (err) {
    res.status(500).json({ error: 'Sign in failed' });
  }
});

/**
 * GET /api/auth/me
 * Fetch authenticated session user profile
 */
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = db.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { passwordHash, ...userProfile } = user;
  res.json({ user: userProfile });
});

/**
 * POST /api/auth/logout
 * Terminate authenticated user session
 */
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ================= DATA ROUTES =================

/**
 * GET /api/scans
 * Fetch scans log (user-scoped for workers, site-wide for officers)
 */
app.get('/api/scans', (req, res) => {
  const isOfficer = req.user && req.user.role === 'officer';
  const userId = req.user ? req.user.id : null;

  const scans = db.getScans(userId, isOfficer);
  res.json({ scans });
});

/**
 * POST /api/scans
 * Record new badge exposure scan
 */
app.post('/api/scans', (req, res) => {
  try {
    const scanData = req.body;
    const userId = req.user ? req.user.id : 'USR-GUEST';
    const userName = req.user ? req.user.name : scanData.workerName || 'Worker';

    const fullScanRecord = {
      ...scanData,
      id: 'SCN-' + Math.floor(1000 + Math.random() * 9000),
      userId,
      workerName: userName,
      createdAt: new Date().toISOString()
    };

    db.addScan(fullScanRecord);

    // Trigger critical exposure alert if threshold exceeded
    if (fullScanRecord.dose > 20) {
      db.addAlert({
        id: 'ALT-' + Math.floor(100 + Math.random() * 900),
        title: `Elevated dose logged (${fullScanRecord.dose} ppm·h)`,
        detail: `${userName} · Badge ${fullScanRecord.badgeId} logged elevated exposure`,
        sev: 'Critical',
        time: 'Just now',
        workerId: userId,
        acknowledged: false
      });
    }

    res.status(201).json({ scan: fullScanRecord });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save scan record' });
  }
});

/**
 * GET /api/workers
 * List workers (for Safety Officers)
 */
app.get('/api/workers', (req, res) => {
  const workers = db.getWorkers();
  res.json({ workers });
});

/**
 * GET /api/badges
 */
app.get('/api/badges', (req, res) => {
  const badges = db.getBadges();
  res.json({ badges });
});

/**
 * GET /api/batches
 */
app.get('/api/batches', (req, res) => {
  const batches = db.getBatches();
  res.json({ batches });
});

/**
 * GET /api/alerts
 */
app.get('/api/alerts', (req, res) => {
  const alerts = db.getAlerts();
  res.json({ alerts });
});

/**
 * POST /api/ml/predict
 * XGBoost Regressor ML model prediction endpoint
 */
app.post('/api/ml/predict', (req, res) => {
  try {
    const { rgb, baselineRgb, envData } = req.body;
    if (!rgb || rgb.r === undefined || rgb.g === undefined || rgb.b === undefined) {
      return res.status(400).json({ error: 'RGB object ({ r, g, b }) is required' });
    }

    const base = baselineRgb || { r: 247, g: 240, b: 228 };
    const features = FeatureExtractor.extractFeatures(rgb, base, envData || {});
    const prediction = XGBoostInferenceEngine.predict(features);

    res.json({
      success: true,
      prediction,
      features
    });
  } catch (err) {
    res.status(500).json({ error: 'XGBoost prediction failed: ' + err.message });
  }
});

/**
 * POST /api/badges/verify
 * Verify badge QR registration and active batch shelf-life status
 */
app.post('/api/badges/verify', (req, res) => {
  try {
    const { badgeId, batchId } = req.body;
    const badges = db.getBadges();
    const batches = db.getBatches();

    const foundBadge = badges.find(b => b.id === badgeId);
    const targetBatchId = batchId || (foundBadge ? foundBadge.batchId : 'H2S-2026-001');
    const foundBatch = batches.find(b => b.batchId === targetBatchId);

    if (!foundBatch) {
      return res.status(404).json({ valid: false, reason: 'Batch calibration metadata not found' });
    }

    const isExpired = new Date() > new Date(foundBatch.expiryDate);

    res.json({
      valid: !isExpired,
      status: isExpired ? 'EXPIRED' : 'VALID',
      badge: foundBadge || { id: badgeId, batchId: targetBatchId },
      batch: foundBatch
    });
  } catch (err) {
    res.status(500).json({ error: 'Badge verification failed: ' + err.message });
  }
});

/**
 * GET /api/scans/stats
 * Dashboard audit metrics (successful vs rejected scans)
 */
app.get('/api/scans/stats', (req, res) => {
  try {
    const scans = db.getScans(null, true);
    const totalScans = scans.length;
    const authenticatedScans = scans.filter(s => s.status !== 'Rejected' && s.authenticated !== false).length;
    const rejectedScans = totalScans - authenticatedScans;
    const highExposureCount = scans.filter(s => s.dose > 20).length;

    res.json({
      totalScans,
      authenticatedScans,
      rejectedScans,
      acceptanceRate: totalScans > 0 ? Math.round((authenticatedScans / totalScans) * 100) : 100,
      highExposureCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scan stats' });
  }
});

// Serve frontend static files from dist/
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// Start Express API Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ H₂S-Track API Backend Server running on http://0.0.0.0:${PORT} (Accessible across local Wi-Fi network)`);
});

