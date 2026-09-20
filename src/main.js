import Alpine from 'alpinejs';
import { createIcons } from 'lucide';
import Chart from 'chart.js/auto';
import { ColorimetryEngine } from './services/colorimetryEngine.js';
import { BadgeAuthenticationService } from './services/badgeAuthenticationService.js';
import { ReportExporter } from './services/reportExporter.js';
import { SimulatedBadge } from './components/simulatedBadge.js';
import { getTranslation, translations } from './services/i18n.js';
import './styles/app.css';

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    view: 'landing',
    role: 'worker',
    rangeFilter: 'Weekly',

    // Multilingual State ('en' | 'hi' | 'mr')
    lang: localStorage.getItem('h2strack_lang') || 'en',

    // Helper translation method
    t(key) {
      return getTranslation(this.lang, key);
    },

    setLang(newLang) {
      this.lang = newLang;
      localStorage.setItem('h2strack_lang', newLang);
      this.$nextTick(() => {
        this.renderIcons();
        this.renderCharts();
      });
    },

    // Authentication State
    authMode: 'login', // 'login' | 'signup'
    token: localStorage.getItem('h2strack_token') || null,
    currentUser: null,
    authError: '',
    authLoading: false,

    // Sign In Form Data
    loginEmail: 'ramesh@panvel-gas.com',
    loginPassword: 'password123',

    // Sign Up Form Data
    signupName: '',
    signupEmail: '',
    signupPassword: '',
    signupRole: 'worker',
    signupSite: 'Panvel Gas Terminal',
    signupUnit: 'Operations',

    // Camera & Scanner State
    scanning: false,
    scanStep: 0,
    cameraActive: false,
    cameraStream: null,
    scanSource: 'simulation',
    simulatedDose: 12.7,
    hasUploadedPhoto: false,
    uploadedPhotoName: '',
    scanValidationError: '',
    rejectionModal: { active: false, code: '', reason: '' },
    qrModal: { active: false, badgeId: 'H2S-001', batchId: 'H2S-2026-001' },
    verificationChecklist: { substrate: false, qr: false, sensor: false, refScale: false, validity: false, verified: false },

    // Current Scan Result State (null for fresh accounts with 0 scans)
    lastScanResult: null,

    // Server Collections
    workers: [],
    badges: [],
    batches: [],
    history: [],
    alerts: [],
    officerStats: [],
    reviewList: [],

    // Scan steps list
    get scanStages() {
      return [
        { label: this.t('badgeDetected') },
        { label: this.t('qrDetected') },
        { label: this.t('sensorRegionDetected') },
        { label: this.t('refScaleDetected') || 'Reference scale detected' },
        { label: this.t('validityChecked') },
        { label: this.t('imgQualityChecked') || 'Image quality checked' },
        { label: this.t('exposureEstimated') }
      ];
    },

    // Navigation menus getters
    get navWorkerItems() {
      return [
        { v: 'home', label: this.t('navHome'), icon: 'home' },
        { v: 'scan', label: this.t('navScan'), icon: 'scan-line' },
        { v: 'history', label: this.t('navHistory'), icon: 'line-chart' },
        { v: 'alerts', label: this.t('navAlerts'), icon: 'bell' }
      ];
    },
    get navOfficerItems() {
      return [
        { v: 'home', label: this.t('navOverview'), icon: 'layout-dashboard' },
        { v: 'scan', label: this.t('navScan'), icon: 'scan-line' },
        { v: 'badges', label: this.t('navBadges'), icon: 'credit-card' },
        { v: 'history', label: this.t('navExposureRecords'), icon: 'line-chart' },
        { v: 'alerts', label: this.t('navAlerts'), icon: 'bell' }
      ];
    },
    get navOfficerMobileItems() {
      return [
        { v: 'home', label: this.t('navOverview'), icon: 'layout-dashboard' },
        { v: 'scan', label: this.t('navScan'), icon: 'scan-line' },
        { v: 'badges', label: this.t('navBadges'), icon: 'credit-card' },
        { v: 'alerts', label: this.t('navAlerts'), icon: 'bell' }
      ];
    },

    async init() {
      // Smart Entry Logic: Mobile opens directly to Sign In / Sign Up, Desktop opens to Landing
      const isMobile = window.innerWidth < 768;

      if (this.token) {
        await this.fetchUserSession();
        this.view = 'home';
      } else {
        if (isMobile) {
          this.view = 'login';
          this.authMode = 'login';
        } else {
          this.view = 'landing';
        }
      }

      await this.refreshData();

      this.$watch('view', (val) => {
        if (val !== 'scan') {
          this.stopCamera();
        }
        this.$nextTick(() => {
          this.renderIcons();
          this.renderCharts();
          if (val === 'scan') {
            this.renderSimulatedBadge();
          }
        });
      });

      this.$watch('role', () => {
        this.refreshData();
        this.$nextTick(() => this.renderIcons());
      });

      this.$watch('simulatedDose', () => {
        this.renderSimulatedBadge();
      });

      this.renderIcons();
    },

    /**
     * Restore user session from backend
     */
    async fetchUserSession() {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          this.currentUser = data.user;
          this.role = data.user.role || 'worker';
        } else {
          this.logout();
        }
      } catch (err) {
        console.warn('Session restoration failed', err);
      }
    },

    /**
     * Quick demo login helper
     */
    quickLogin(email, password) {
      this.loginEmail = email;
      this.loginPassword = password;
      this.handleLogin();
    },

    /**
     * Authenticate Login Endpoint
     */
    async handleLogin() {
      this.authError = '';
      this.authLoading = true;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.loginEmail, password: this.loginPassword })
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Login failed');
        }

        this.token = data.token;
        this.currentUser = data.user;
        this.role = data.user.role || 'worker';
        localStorage.setItem('h2strack_token', data.token);

        await this.refreshData();
        this.view = 'home';
      } catch (err) {
        this.authError = err.message;
      } finally {
        this.authLoading = false;
      }
    },

    /**
     * Register New User Endpoint (Fresh Account Isolation)
     */
    async handleSignup() {
      this.authError = '';
      this.authLoading = true;
      try {
        if (!this.signupName || !this.signupEmail || !this.signupPassword) {
          throw new Error('Please fill in your name, email, and password.');
        }

        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: this.signupName,
            email: this.signupEmail,
            password: this.signupPassword,
            role: this.signupRole,
            site: this.signupSite,
            unit: this.signupUnit
          })
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Sign up failed');
        }

        this.token = data.token;
        this.currentUser = data.user;
        this.role = data.user.role || 'worker';
        localStorage.setItem('h2strack_token', data.token);

        // Reset forms
        this.signupName = '';
        this.signupEmail = '';
        this.signupPassword = '';

        await this.refreshData();
        this.view = 'home';
      } catch (err) {
        this.authError = err.message;
      } finally {
        this.authLoading = false;
      }
    },

    /**
     * Logout Session
     */
    async logout() {
      if (this.token) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` }
          });
        } catch (e) {}
      }

      this.token = null;
      this.currentUser = null;
      this.lastScanResult = null;
      this.history = [];
      localStorage.removeItem('h2strack_token');
      this.view = window.innerWidth < 768 ? 'login' : 'landing';
      this.authMode = 'login';
      this.$nextTick(() => this.renderIcons());
    },

    /**
     * Refresh data from backend API endpoints
     */
    async refreshData() {
      const authHeader = this.token ? { 'Authorization': `Bearer ${this.token}` } : {};

      try {
        const [scansRes, badgesRes, batchesRes, alertsRes, workersRes] = await Promise.all([
          fetch('/api/scans', { headers: authHeader }),
          fetch('/api/badges', { headers: authHeader }),
          fetch('/api/batches', { headers: authHeader }),
          fetch('/api/alerts', { headers: authHeader }),
          fetch('/api/workers', { headers: authHeader })
        ]);

        if (scansRes.ok) {
          const s = await scansRes.json();
          this.history = s.scans || [];
          if (this.history.length > 0) {
            this.lastScanResult = this.history[0];
          } else {
            this.lastScanResult = null;
          }
        }
        if (badgesRes.ok) {
          const b = await badgesRes.json();
          this.badges = b.badges || [];
        }
        if (batchesRes.ok) {
          const bt = await batchesRes.json();
          this.batches = bt.batches || [];
        }
        if (alertsRes.ok) {
          const a = await alertsRes.json();
          this.alerts = a.alerts || [];
        }
        if (workersRes.ok) {
          const w = await workersRes.json();
          this.workers = w.workers || [];
        }
      } catch (err) {
        console.warn('API data fetch failed', err);
      }

      // Stats calculation
      const totalWorkers = this.workers.length || 1;
      const activeBadges = this.badges.filter(b => b.status === 'In Use' || b.status === 'Scanned').length || 0;
      const scansCount = this.history.length;

      this.officerStats = [
        { label: this.t('registeredWorkers'), value: totalWorkers.toString() },
        { label: this.t('activeBadges'), value: activeBadges.toString() },
        { label: this.t('scansLogged'), value: scansCount.toString() },
        { label: this.t('highExposureAlerts'), value: this.alerts.filter(a => a.sev === 'Critical').length.toString() }
      ];

      this.reviewList = [
        { name: 'Suresh Patil · W-014', reason: 'Elevated shift dose (32.4 ppm·h)', sev: 'Critical' },
        { name: 'Amit Joshi · W-062', reason: 'Badge H2S-088 due for shift end scan', sev: 'Warning' }
      ];
    },

    renderIcons() {
      createIcons();
    },

    startScan() {
      this.view = 'scan';
      this.scanStep = 0;
      this.scanning = false;
      this.$nextTick(() => {
        this.renderIcons();
        this.renderSimulatedBadge();
      });
    },

    async startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        this.cameraStream = stream;
        this.cameraActive = true;
        this.scanSource = 'camera';

        this.$nextTick(() => {
          const video = document.getElementById('cameraVideo');
          if (video) {
            video.srcObject = stream;
            video.play();
          }
        });
      } catch (err) {
        console.warn('Camera fallback triggered', err);
        alert('Camera access denied or unverified host. Note: Mobile browsers require camera permissions. Using Simulated Badge reader.');
        this.scanSource = 'simulation';
      }
    },

    stopCamera() {
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach(track => track.stop());
        this.cameraStream = null;
      }
      this.cameraActive = false;
    },

    handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.scanSource = 'upload';
          this.hasUploadedPhoto = true;
          this.uploadedPhotoName = file.name || 'Wristband Photo';
          this.scanValidationError = '';

          const canvas = document.getElementById('simulatedBadgeCanvas');
          if (canvas) {
            canvas.width = img.naturalWidth || img.width || 600;
            canvas.height = img.naturalHeight || img.height || 300;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    },

    renderSimulatedBadge() {
      const canvas = document.getElementById('simulatedBadgeCanvas');
      if (canvas && this.scanSource === 'simulation') {
        const badgeId = this.currentUser ? 'H2S-' + (this.currentUser.workerId || '001') : 'H2S-001';
        SimulatedBadge.drawBadge(canvas, parseFloat(this.simulatedDose), badgeId, 'H2S-2026-001');
      }
    },

    runScan() {
      this.scanValidationError = '';

      // Enforce "No Input -> No Output": Check if photo uploaded when in upload mode
      if (this.scanSource === 'upload' && !this.hasUploadedPhoto) {
        const msg = this.t('noPhotoError');
        this.scanValidationError = msg;
        alert(msg);
        return;
      }

      this.scanning = true;
      let i = 0;

      const interval = setInterval(() => {
        i++;
        this.scanStep = i;

        if (i >= this.scanStages.length) {
          clearInterval(interval);

          let canvasToScan = null;

          if (this.scanSource === 'simulation' || this.scanSource === 'upload') {
            canvasToScan = document.getElementById('simulatedBadgeCanvas');
          } else if (this.scanSource === 'camera') {
            const video = document.getElementById('cameraVideo');
            if (video) {
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = video.videoWidth || 640;
              tempCanvas.height = video.videoHeight || 480;
              const ctx = tempCanvas.getContext('2d');
              ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
              canvasToScan = tempCanvas;
            }
          }

          if (!canvasToScan) {
            this.scanning = false;
            alert('Canvas or video stream unavailable for scanning');
            return;
          }

          const ctx = canvasToScan.getContext('2d');
          const authResult = BadgeAuthenticationService.authenticateAndProcess(ctx, canvasToScan.width, canvasToScan.height);

          if (!authResult.authenticated || !authResult.xgboostAllowed) {
            this.scanning = false;
            this.rejectionModal = {
              active: true,
              code: authResult.rejectionCode || 'AUTHENTICATION_FAILED',
              reason: authResult.rejectionReason || 'Badge could not be authenticated. Exposure prediction blocked.'
            };
            this.stopCamera();
            this.$nextTick(() => this.renderIcons());
            return;
          }

          const doseResult = authResult.doseResult;
          const sampledRgb = doseResult.features ? { r: doseResult.features.r, g: doseResult.features.g, b: doseResult.features.b } : { r: 138, g: 90, b: 42 };

          const now = new Date();
          const todayDateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

          const userName = this.currentUser ? this.currentUser.name : 'Worker';
          const userId = this.currentUser ? this.currentUser.id : 'W-027';
          const badgeId = this.currentUser ? 'H2S-' + (this.currentUser.workerId || '001') : 'H2S-001';

          this.lastScanResult = {
            id: 'SCN-' + Math.floor(1000 + Math.random() * 9000),
            date: todayDateStr,
            isoDate: now.toISOString().split('T')[0],
            time: timeStr,
            shift: '08:00–16:00',
            workerId: userId,
            workerName: userName,
            badgeId: badgeId,
            batchId: 'H2S-2026-001',
            dose: doseResult.dose,
            uncertainty: doseResult.uncertainty,
            status: doseResult.status,
            quality: 'Good',
            rgb: sampledRgb,
            deltaE: doseResult.deltaE,
            calibration: doseResult.curve
          };

          setTimeout(() => {
            this.stopCamera();
            this.view = 'result';
            this.scanning = false;
            this.$nextTick(() => this.renderIcons());
          }, 400);
        }
      }, 350);
    },

    async saveLastScan() {
      try {
        const authHeader = this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
        const res = await fetch('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(this.lastScanResult)
        });
        if (res.ok) {
          await this.refreshData();
        }
      } catch (err) {
        console.warn('Saving scan to backend failed', err);
      }

      this.view = 'home';
    },

    exportCSV() {
      ReportExporter.exportToCSV(this.history);
    },

    exportPDF() {
      const userName = this.currentUser ? this.currentUser.name : 'Worker';
      const userId = this.currentUser ? this.currentUser.id : 'W-027';
      const scanToExport = this.lastScanResult || {
        dose: 0.0,
        badgeId: 'H2S-001',
        batchId: 'H2S-2026-001',
        date: new Date().toLocaleDateString('en-GB'),
        shift: '08:00–16:00'
      };
      ReportExporter.exportPDFReport(scanToExport, { name: userName, id: userId });
    },

    renderCharts() {
      const labels = [...this.history].map(h => h.date).reverse();
      const data = [...this.history].map(h => h.dose).reverse();

      ['historyChart', 'officerChart'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        if (el._chart) el._chart.destroy();

        if (labels.length === 0) {
          labels.push('Today');
          data.push(0);
        }

        el._chart = new Chart(el, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              data,
              borderColor: '#8A5A2A',
              backgroundColor: 'rgba(138,90,42,0.08)',
              fill: true,
              tension: 0.35,
              pointRadius: 4,
              pointBackgroundColor: '#8A5A2A',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                grid: { color: '#EFE3D0' },
                ticks: { color: '#8A8A8E', font: { size: 10 } },
                suggestedMin: 0,
                suggestedMax: 40
              },
              x: {
                grid: { display: false },
                ticks: { color: '#8A8A8E', font: { size: 10 } }
              }
            }
          }
        });
      });
    }
  }));
});

Alpine.start();
