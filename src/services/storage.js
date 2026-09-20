// LocalStorage persistence service for H₂S-Track

const STORAGE_KEYS = {
  SESSION: 'h2strack_session',
  WORKERS: 'h2strack_workers',
  BADGES: 'h2strack_badges',
  BATCHES: 'h2strack_batches',
  SCANS: 'h2strack_scans',
  ALERTS: 'h2strack_alerts',
  SETTINGS: 'h2strack_settings'
};

const DEFAULT_WORKERS = [
  { id: 'W-027', name: 'Ramesh Kadam', role: 'Operator', site: 'Panvel Gas Terminal', unit: 'Unit 4 Compression', status: 'Active' },
  { id: 'W-014', name: 'Suresh Patil', role: 'Maintenance Tech', site: 'Panvel Gas Terminal', unit: 'Sulfur Recovery', status: 'Active' },
  { id: 'W-062', name: 'Amit Joshi', role: 'Field Operator', site: 'Panvel Gas Terminal', unit: 'Tank Farm B', status: 'Active' },
  { id: 'W-039', name: 'Farhan Sheikh', role: 'Inspection Eng.', site: 'Panvel Gas Terminal', unit: 'Pipeline Spur 2', status: 'Active' },
  { id: 'W-088', name: 'Priya Sharma', role: 'Chemist', site: 'Panvel Gas Terminal', unit: 'EHS Lab', status: 'Active' }
];

const DEFAULT_BATCHES = [
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
  }
];

const DEFAULT_BADGES = [
  { id: 'H2S-001', batchId: 'H2S-2026-001', workerId: 'W-027', workerName: 'Ramesh Kadam', status: 'In Use', issuedDate: '2026-09-01' },
  { id: 'H2S-002', batchId: 'H2S-2026-001', workerId: 'W-014', workerName: 'Suresh Patil', status: 'Scanned', issuedDate: '2026-09-01' },
  { id: 'H2S-003', batchId: 'H2S-2026-001', workerId: null, workerName: 'Unassigned', status: 'Available', issuedDate: '2026-09-01' },
  { id: 'H2S-071', batchId: 'H2S-2026-002', workerId: 'W-039', workerName: 'Farhan Sheikh', status: 'Scanned', issuedDate: '2026-08-10' },
  { id: 'H2S-088', batchId: 'H2S-2026-001', workerId: 'W-062', workerName: 'Amit Joshi', status: 'In Use', issuedDate: '2026-09-02' }
];

const DEFAULT_SCANS = [
  {
    id: 'SCN-1092',
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
    id: 'SCN-1075',
    date: '09 Sep 2026',
    isoDate: '2026-09-09',
    time: '16:12',
    shift: '08:00–16:00',
    workerId: 'W-027',
    workerName: 'Ramesh Kadam',
    badgeId: 'H2S-088',
    batchId: 'H2S-2026-001',
    dose: 15.4,
    uncertainty: 1.4,
    status: 'Valid',
    quality: 'Good',
    rgb: { r: 125, g: 78, b: 32 },
    deltaE: 28.6,
    calibration: 'C17'
  },
  {
    id: 'SCN-1064',
    date: '08 Sep 2026',
    isoDate: '2026-09-08',
    time: '08:04',
    shift: '00:00–08:00',
    workerId: 'W-027',
    workerName: 'Ramesh Kadam',
    badgeId: 'H2S-071',
    batchId: 'H2S-2026-002',
    dose: 6.1,
    uncertainty: 1.2,
    status: 'Valid',
    quality: 'Good',
    rgb: { r: 180, g: 140, b: 85 },
    deltaE: 13.9,
    calibration: 'C18'
  },
  {
    id: 'SCN-1052',
    date: '07 Sep 2026',
    isoDate: '2026-09-07',
    time: '16:00',
    shift: '08:00–16:00',
    workerId: 'W-027',
    workerName: 'Ramesh Kadam',
    badgeId: 'H2S-063',
    batchId: 'H2S-2026-001',
    dose: 9.9,
    uncertainty: 1.4,
    status: 'Valid',
    quality: 'Good',
    rgb: { r: 155, g: 108, b: 54 },
    deltaE: 20.3,
    calibration: 'C17'
  },
  {
    id: 'SCN-1044',
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
];

const DEFAULT_ALERTS = [
  {
    id: 'ALT-001',
    title: 'Repeated elevated exposure — requires review',
    detail: 'W-014 Suresh Patil · 3 shifts above threshold (32.4 ppm·h)',
    sev: 'Critical',
    time: '2h ago',
    workerId: 'W-014',
    acknowledged: false
  },
  {
    id: 'ALT-002',
    title: 'Badge validity uncertain',
    detail: 'Badge H2S-071 · control patch response out of expected range',
    sev: 'Warning',
    time: '5h ago',
    workerId: 'W-039',
    acknowledged: false
  },
  {
    id: 'ALT-003',
    title: 'Poor scan quality retry notice',
    detail: 'W-039 Farhan Sheikh · high specular glare detected during scan',
    sev: 'Attention',
    time: '6h ago',
    workerId: 'W-039',
    acknowledged: true
  }
];

export class StorageService {
  static get(key, defaultValue) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn(`Error reading key ${key} from localStorage`, e);
      return defaultValue;
    }
  }

  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error saving key ${key} to localStorage`, e);
    }
  }

  static initSeed() {
    if (!localStorage.getItem(STORAGE_KEYS.WORKERS)) {
      this.set(STORAGE_KEYS.WORKERS, DEFAULT_WORKERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.BATCHES)) {
      this.set(STORAGE_KEYS.BATCHES, DEFAULT_BATCHES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.BADGES)) {
      this.set(STORAGE_KEYS.BADGES, DEFAULT_BADGES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SCANS)) {
      this.set(STORAGE_KEYS.SCANS, DEFAULT_SCANS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ALERTS)) {
      this.set(STORAGE_KEYS.ALERTS, DEFAULT_ALERTS);
    }
  }

  static getWorkers() { return this.get(STORAGE_KEYS.WORKERS, DEFAULT_WORKERS); }
  static saveWorkers(data) { this.set(STORAGE_KEYS.WORKERS, data); }

  static getBadges() { return this.get(STORAGE_KEYS.BADGES, DEFAULT_BADGES); }
  static saveBadges(data) { this.set(STORAGE_KEYS.BADGES, data); }

  static getBatches() { return this.get(STORAGE_KEYS.BATCHES, DEFAULT_BATCHES); }
  static saveBatches(data) { this.set(STORAGE_KEYS.BATCHES, data); }

  static getScans() { return this.get(STORAGE_KEYS.SCANS, DEFAULT_SCANS); }
  static saveScans(data) { this.set(STORAGE_KEYS.SCANS, data); }

  static addScan(scanRecord) {
    const scans = this.getScans();
    scans.unshift(scanRecord);
    this.saveScans(scans);
    return scans;
  }

  static getAlerts() { return this.get(STORAGE_KEYS.ALERTS, DEFAULT_ALERTS); }
  static saveAlerts(data) { this.set(STORAGE_KEYS.ALERTS, data); }

  static addAlert(alertRecord) {
    const alerts = this.getAlerts();
    alerts.unshift(alertRecord);
    this.saveAlerts(alerts);
    return alerts;
  }
}
