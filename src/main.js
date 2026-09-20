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
    signupCompany: '',
    signupIsIndependent: false,
    signupSite: 'Panvel Gas Terminal',
    signupUnit: 'Operations',
    pendingJoinRequests: [],

    // Data Scoping & Multi-Tenant Data Isolation Getters
    get filteredAlerts() {
      if (!this.currentUser) return this.alerts;
      if (this.currentUser.role === 'worker') {
        return this.alerts.filter(a =>
          !a.userId ||
          a.userId === 'USR-GUEST' ||
          a.userId === this.currentUser.id ||
          a.workerId === this.currentUser.id ||
          a.workerId === this.currentUser.workerId ||
          a.workerName === this.currentUser.name ||
          a.workerName === 'Worker'
        );
      }
      return this.alerts.filter(a => {
        if (!this.currentUser.company || this.currentUser.company === 'Independent') return true;
        return a.company === this.currentUser.company || !a.company || a.company === 'Panvel Gas Terminal';
      });
    },

    get filteredHistory() {
      if (!this.currentUser) return this.history;
      if (this.currentUser.role === 'worker') {
        return this.history.filter(h =>
          !h.userId ||
          h.userId === 'USR-GUEST' ||
          h.userId === this.currentUser.id ||
          h.workerId === this.currentUser.id ||
          h.workerId === this.currentUser.workerId ||
          h.workerName === this.currentUser.name ||
          h.workerName === 'Worker'
        );
      }
      return this.history;
    },

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
    healthAlertModal: { active: false, dose: 0, status: '', severity: '' },
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

      this.$watch('rangeFilter', () => {
        this.renderCharts();
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
            company: this.signupIsIndependent ? 'Independent' : this.signupCompany,
            isIndependent: this.signupIsIndependent,
            site: this.signupIsIndependent ? 'Personal Workspace' : (this.signupCompany || 'Panvel Gas Terminal'),
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
        this.signupCompany = '';
        this.signupIsIndependent = false;

        await this.refreshData();
        this.view = 'home';
      } catch (err) {
        this.authError = err.message;
      } finally {
        this.authLoading = false;
      }
    },

    async fetchPendingJoinRequests() {
      if (!this.token || this.role !== 'officer') return;
      try {
        const res = await fetch('/api/company/pending-requests', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          this.pendingJoinRequests = data.requests || [];
        }
      } catch (err) {}
    },

    async approveJoinRequest(userId) {
      try {
        const res = await fetch('/api/company/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
          body: JSON.stringify({ userId })
        });
        if (res.ok) {
          await this.fetchPendingJoinRequests();
          await this.refreshData();
          alert('Worker join request approved!');
        }
      } catch (err) {
        alert('Failed to approve request');
      }
    },

    async rejectJoinRequest(userId) {
      try {
        const res = await fetch('/api/company/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
          body: JSON.stringify({ userId })
        });
        if (res.ok) {
          await this.fetchPendingJoinRequests();
          await this.refreshData();
          alert('Worker request rejected.');
        }
      } catch (err) {
        alert('Failed to reject request');
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
        await this.fetchPendingJoinRequests();
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

          // Create isolated dedicated canvas for uploaded image (never overwritten by simulation)
          const uploadCanvas = document.createElement('canvas');
          uploadCanvas.width = img.naturalWidth || img.width || 600;
          uploadCanvas.height = img.naturalHeight || img.height || 300;
          const uCtx = uploadCanvas.getContext('2d');
          uCtx.drawImage(img, 0, 0, uploadCanvas.width, uploadCanvas.height);
          this._uploadedCanvas = uploadCanvas;

          // Render preview to UI canvas
          const canvas = document.getElementById('simulatedBadgeCanvas');
          if (canvas) {
            canvas.width = uploadCanvas.width;
            canvas.height = uploadCanvas.height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(uploadCanvas, 0, 0, canvas.width, canvas.height);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    },

    renderSimulatedBadge() {
      if (this.scanSource !== 'simulation') return; // NEVER overwrite uploaded image canvas!
      const canvas = document.getElementById('simulatedBadgeCanvas');
      if (canvas) {
        const badgeId = this.currentUser ? 'H2S-' + (this.currentUser.workerId || '001') : 'H2S-001';
        SimulatedBadge.drawBadge(canvas, parseFloat(this.simulatedDose), badgeId, '202609-2701');
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

          if (this.scanSource === 'upload') {
            canvasToScan = this._uploadedCanvas || document.getElementById('simulatedBadgeCanvas');
          } else if (this.scanSource === 'simulation') {
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

          if (doseResult.dose >= 90.0) {
            this.healthAlertModal = {
              active: true,
              dose: doseResult.dose,
              status: doseResult.status,
              severity: doseResult.dose >= 180 ? 'EXTREME HAZARD (240 ppm·h)' : 'CRITICAL HIGH EXPOSURE (>=90 ppm·h)'
            };
          }

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
      if (this.lastScanResult) {
        const userName = this.currentUser ? this.currentUser.name : 'Worker';
        const userId = this.currentUser ? this.currentUser.id : 'USR-GUEST';
        const userCompany = this.currentUser ? this.currentUser.company : '';

        const formattedScan = {
          ...this.lastScanResult,
          id: 'SCN-' + Math.floor(1000 + Math.random() * 9000),
          userId,
          workerName: userName,
          workerId: this.currentUser ? (this.currentUser.workerId || userId) : 'W-001',
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          shift: '08:00–16:00',
          badgeId: this.lastScanResult.badgeId || 'H2S-001'
        };

        // Optimistically add to client history
        this.history.unshift(formattedScan);

        // Generate exposure alert for dose >= 20 ppm·h
        if (formattedScan.dose >= 20) {
          let title = `Action Level Exposure Reached (${formattedScan.dose} ppm·h)`;
          let sev = 'Warning';
          if (formattedScan.dose >= 180) {
            title = `EXTREME Exposure Detected (${formattedScan.dose} ppm·h)`;
            sev = 'Critical';
          } else if (formattedScan.dose >= 90) {
            title = `Critical High Exposure Detected (${formattedScan.dose} ppm·h)`;
            sev = 'Critical';
          }

          const newAlert = {
            id: 'ALT-' + Math.floor(1000 + Math.random() * 9000),
            title,
            detail: `${userName} · Badge ${formattedScan.badgeId} logged exposure measurement`,
            sev,
            time: 'Just now',
            userId: userId,
            workerId: userId,
            workerName: userName,
            company: userCompany,
            acknowledged: false,
            createdAt: new Date().toISOString()
          };

          this.alerts.unshift(newAlert);
        }

        try {
          const authHeader = this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
          const res = await fetch('/api/scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify(formattedScan)
          });
          if (res.ok) {
            await this.refreshData();
          }
        } catch (err) {
          console.warn('Saving scan to backend failed', err);
        }
      }

      this.view = 'history';
      this.$nextTick(() => {
        this.renderIcons();
        this.renderCharts();
      });
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
        batchId: '202609-2701',
        date: new Date().toLocaleDateString('en-GB'),
        shift: '08:00–16:00'
      };
      ReportExporter.exportPDFReport(scanToExport, { name: userName, id: userId });
    },

    renderCharts() {
      this.$nextTick(() => {
        let filtered = [...this.filteredHistory];
        if (this.rangeFilter === 'Weekly') {
          filtered = filtered.slice(0, 7);
        } else if (this.rangeFilter === 'Monthly') {
          filtered = filtered.slice(0, 30);
        }

        const labels = filtered.map(h => h.date ? (h.date.split(' ')[0] + ' ' + (h.date.split(' ')[1] || '')) : 'Today').reverse();
        const data = filtered.map(h => (typeof h.dose === 'number' ? h.dose : parseFloat(h.dose) || 0)).reverse();

        if (labels.length === 0) {
          labels.push('Today');
          data.push(0);
        }

        ['historyChart', 'officerChart'].forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;

          if (el._chart) {
            try { el._chart.destroy(); } catch (e) {}
          }

          const ctx = el.getContext('2d');
          const gradient = ctx.createLinearGradient(0, 0, 0, 180);
          gradient.addColorStop(0, 'rgba(245, 158, 11, 0.40)');
          gradient.addColorStop(1, 'rgba(245, 158, 11, 0.01)');

          const maxVal = Math.max(50, ...data);

          el._chart = new Chart(el, {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: 'H₂S Exposure (ppm·h)',
                data,
                borderColor: '#F59E0B',
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#B45309',
                pointBorderColor: '#FFFFFF',
                pointBorderWidth: 2,
                borderWidth: 3
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  enabled: true,
                  callbacks: {
                    label: (ctx) => `${ctx.parsed.y} ppm·h`
                  }
                }
              },
              scales: {
                y: {
                  grid: { color: 'rgba(0, 0, 0, 0.06)' },
                  ticks: { color: '#64748B', font: { size: 11, weight: '600' } },
                  suggestedMin: 0,
                  suggestedMax: maxVal + 10
                },
                x: {
                  grid: { display: false },
                  ticks: { color: '#64748B', font: { size: 10, weight: '600' } }
                }
              }
            }
          });
        });
      });
    }
  }));
});

Alpine.start();
