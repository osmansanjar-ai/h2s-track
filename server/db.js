import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Generate default password hash ('password123')
const defaultPasswordHash = bcrypt.hashSync('password123', 10);

const SEED_DATA = {
  users: [
    {
      id: 'USR-027',
      workerId: 'W-027',
      name: 'Ramesh Kadam',
      email: 'ramesh@panvel-gas.com',
      passwordHash: defaultPasswordHash,
      role: 'worker',
      site: 'Panvel Gas Terminal',
      unit: 'Unit 4 Compression',
      createdAt: new Date().toISOString()
    },
    {
      id: 'USR-014',
      workerId: 'W-014',
      name: 'Suresh Patil',
      email: 'suresh@panvel-gas.com',
      passwordHash: defaultPasswordHash,
      role: 'worker',
      site: 'Panvel Gas Terminal',
      unit: 'Sulfur Recovery',
      createdAt: new Date().toISOString()
    },
    {
      id: 'USR-999',
      workerId: 'OFFICER-01',
      name: 'Dr. V. Sharma',
      email: 'officer@panvel-gas.com',
      passwordHash: defaultPasswordHash,
      role: 'officer',
      site: 'Panvel Gas Terminal',
      unit: 'EHS Executive Management',
      createdAt: new Date().toISOString()
    }
  ],
  batches: [
    {
      batchId: 'H2S-2026-001',
      mfgDate: '2026-01-15',
      expiryDate: '2028-12-31',
      curve: 'C17',
      coeffA: 0.82,
      coeffB: 1.45,
      coeffC: 0.0,
      uncertainty: 1.4,
      status: 'Validated'
    },
    {
      batchId: 'H2S-2026-002',
      mfgDate: '2026-02-01',
      expiryDate: '2028-12-31',
      curve: 'C18',
      coeffA: 0.88,
      coeffB: 1.40,
      coeffC: 0.1,
      uncertainty: 1.2,
      status: 'Validated'
    },
    {
      batchId: 'H2S-2025-EXPIRED',
      mfgDate: '2024-01-01',
      expiryDate: '2025-01-01',
      curve: 'C15',
      coeffA: 0.80,
      coeffB: 1.50,
      coeffC: 0.0,
      uncertainty: 1.8,
      status: 'Expired'
    }
  ],
  badges: [
    { id: 'H2S-001', batchId: 'H2S-2026-001', workerId: 'W-027', workerName: 'Ramesh Kadam', status: 'In Use', issuedDate: '2026-09-01' },
    { id: 'H2S-002', batchId: 'H2S-2026-001', workerId: 'W-014', workerName: 'Suresh Patil', status: 'Scanned', issuedDate: '2026-09-01' },
    { id: 'H2S-003', batchId: 'H2S-2026-001', workerId: null, workerName: 'Unassigned', status: 'Available', issuedDate: '2026-09-01' },
    { id: 'H2S-071', batchId: 'H2S-2026-002', workerId: 'USR-027', workerName: 'Ramesh Kadam', status: 'Scanned', issuedDate: '2026-08-10' },
    { id: 'H2S-EXP', batchId: 'H2S-2025-EXPIRED', workerId: 'USR-027', workerName: 'Ramesh Kadam', status: 'Expired', issuedDate: '2024-02-01' }
  ],
  scans: [
    {
      id: 'SCN-1092',
      userId: 'USR-027',
      date: '11 Sep 2026',
      isoDate: '2026-09-11',
      time: '16:08',
      shift: '08:00–16:00',
      workerId: 'W-027',
      workerName: 'Ramesh Kadam',
      badgeId: 'H2S-001',
      batchId: 'H2S-2026-001',
      dose: 12.7,
      uncertainty: 1.4,
      status: 'Valid',
      quality: 'Good',
      rgb: { r: 138, g: 90, b: 42 },
      deltaE: 24.8,
      calibration: 'C17'
    },
    {
      id: 'SCN-1088',
      userId: 'USR-027',
      date: '10 Sep 2026',
      isoDate: '2026-09-10',
      time: '16:05',
      shift: '08:00–16:00',
      workerId: 'W-027',
      workerName: 'Ramesh Kadam',
      badgeId: 'H2S-097',
      batchId: 'H2S-2026-001',
      dose: 8.2,
      uncertainty: 1.4,
      status: 'Valid',
      quality: 'Good',
      rgb: { r: 165, g: 120, b: 65 },
      deltaE: 17.5,
      calibration: 'C17'
    },
    {
      id: 'SCN-1044',
      userId: 'USR-014',
      date: '11 Sep 2026',
      isoDate: '2026-09-11',
      time: '15:45',
      shift: '08:00–16:00',
      workerId: 'W-014',
      workerName: 'Suresh Patil',
      badgeId: 'H2S-002',
      batchId: 'H2S-2026-001',
      dose: 32.4,
      uncertainty: 1.4,
      status: 'Valid',
      quality: 'Good',
      rgb: { r: 90, g: 50, b: 20 },
      deltaE: 48.2,
      calibration: 'C17'
    }
  ],
  alerts: [
    {
      id: 'ALT-001',
      title: 'Repeated elevated exposure — requires review',
      detail: 'W-014 Suresh Patil · 3 shifts above threshold (32.4 ppm·h)',
      sev: 'Critical',
      time: '2h ago',
      workerId: 'W-014',
      acknowledged: false
    }
  ]
};

class Database {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      this.write(SEED_DATA);
    }
  }

  read() {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading database file, writing seed data...', err);
      this.write(SEED_DATA);
      return SEED_DATA;
    }
  }

  write(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  // User Operations
  findUserByEmail(email) {
    const db = this.read();
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id) {
    const db = this.read();
    return db.users.find(u => u.id === id);
  }

  createUser(userData) {
    const db = this.read();
    const existing = db.users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existing) {
      throw new Error('User with this email already exists');
    }

    const rawCompany = (userData.company || '').trim();
    const isIndependent = !rawCompany || rawCompany.toLowerCase() === 'independent' || userData.isIndependent;
    const companyName = isIndependent ? 'Independent' : rawCompany;
    
    // Safety Officers and Independent users are auto-approved; Workers with a company start as 'Pending'
    const companyStatus = (userData.role === 'officer' || isIndependent) ? 'Approved' : 'Pending';

    const newUser = {
      id: 'USR-' + Math.floor(1000 + Math.random() * 9000),
      workerId: userData.workerId || 'W-' + Math.floor(100 + Math.random() * 900),
      name: userData.name,
      email: userData.email.toLowerCase(),
      passwordHash: bcrypt.hashSync(userData.password, 10),
      role: userData.role || 'worker',
      company: companyName,
      companyStatus: companyStatus,
      site: userData.site || (isIndependent ? 'Personal Workspace' : companyName),
      unit: userData.unit || 'Operations',
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    this.write(db);

    const { passwordHash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  getPendingJoinRequests(officerCompany) {
    const db = this.read();
    if (!officerCompany || officerCompany === 'Independent') {
      return db.users.filter(u => u.role === 'worker' && u.companyStatus === 'Pending').map(({ passwordHash, ...u }) => u);
    }
    return db.users.filter(u =>
      u.role === 'worker' &&
      u.companyStatus === 'Pending' &&
      u.company.toLowerCase() === officerCompany.toLowerCase()
    ).map(({ passwordHash, ...u }) => u);
  }

  approveJoinRequest(userId) {
    const db = this.read();
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.companyStatus = 'Approved';
      this.write(db);
      const { passwordHash, ...u } = user;
      return u;
    }
    throw new Error('User not found');
  }

  rejectJoinRequest(userId) {
    const db = this.read();
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.company = 'Independent';
      user.companyStatus = 'Approved';
      this.write(db);
      const { passwordHash, ...u } = user;
      return u;
    }
    throw new Error('User not found');
  }

  getWorkers() {
    const db = this.read();
    return db.users
      .filter(u => u.role === 'worker')
      .map(({ passwordHash, ...u }) => u);
  }

  // Scans Operations
  getScans(userId = null, isOfficer = false) {
    const db = this.read();
    if (isOfficer || !userId) {
      return db.scans;
    }
    return db.scans.filter(s => s.userId === userId);
  }

  addScan(scanData) {
    const db = this.read();
    db.scans.unshift(scanData);
    this.write(db);
    return scanData;
  }

  // Badges & Batches Operations
  getBadges() {
    const db = this.read();
    return db.badges;
  }

  getBatches() {
    const db = this.read();
    return db.batches;
  }

  // Alerts Operations
  getAlerts() {
    const db = this.read();
    return db.alerts;
  }

  addAlert(alertData) {
    const db = this.read();
    db.alerts.unshift(alertData);
    this.write(db);
    return alertData;
  }
}

export const db = new Database();
