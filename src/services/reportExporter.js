// Compliance Report Export Service for H₂S-Track

import { jsPDF } from 'jspdf';

export class ReportExporter {
  /**
   * Export scan records to downloadable CSV
   */
  static exportToCSV(scans, filename = 'H2S_Exposure_Records.csv') {
    if (!scans || !scans.length) return;

    const headers = [
      'Scan ID',
      'Date',
      'Time',
      'Shift',
      'Worker ID',
      'Worker Name',
      'Badge ID',
      'Batch ID',
      'Cumulative Exposure (ppm*h)',
      'Uncertainty (+/- ppm*h)',
      'Status',
      'Scan Quality'
    ];

    const rows = scans.map(s => [
      `"${s.id || ''}"`,
      `"${s.date || ''}"`,
      `"${s.time || ''}"`,
      `"${s.shift || ''}"`,
      `"${s.workerId || ''}"`,
      `"${s.workerName || ''}"`,
      `"${s.badgeId || ''}"`,
      `"${s.batchId || ''}"`,
      s.dose,
      s.uncertainty || 1.4,
      `"${s.status || 'Valid'}"`,
      `"${s.quality || 'Good'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export clean, formal PDF shift compliance certificate for EHS safety audits
   */
  static exportPDFReport(scan, worker = {}) {
    const doc = new jsPDF();

    // Header Branding
    doc.setFillColor(240, 196, 25);
    doc.rect(0, 0, 210, 24, 'F');

    doc.setTextColor(28, 30, 33);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('H2S-Track — Shift Exposure Compliance Certificate', 14, 16);

    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text('Panvel Gas Terminal — Industrial EHS Safety Portal', 14, 32);
    doc.text(`Certificate Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 38);

    doc.setDrawColor(227, 228, 232);
    doc.line(14, 42, 196, 42);

    // Section 1: Worker & Badge Details
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('1. Worker & Dosimeter Information', 14, 52);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Worker Name: ${scan.workerName || worker.name || 'Worker'}`, 14, 62);
    doc.text(`Worker ID: ${scan.workerId || worker.id || 'W-027'}`, 14, 68);
    doc.text(`Shift Period: ${scan.shift || '08:00–16:00'} (${scan.date || 'Today'} ${scan.time || ''})`, 14, 74);

    doc.text(`Badge Serial: ${scan.badgeId || 'H2S-001'}`, 110, 62);
    doc.text(`Batch ID: ${scan.batchId || 'H2S-2026-001'}`, 110, 68);
    doc.text(`Calibration Curve: Batch C17 (Standard)`, 110, 74);

    // Section 2: Dosimetric Quantification Result
    doc.setDrawColor(227, 228, 232);
    doc.line(14, 82, 196, 82);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('2. Quantitative Shift Exposure Measurement', 14, 92);

    // Clean Box highlight for Dose
    doc.setFillColor(247, 248, 250);
    doc.roundedRect(14, 98, 182, 38, 3, 3, 'F');
    doc.setDrawColor(227, 228, 232);
    doc.roundedRect(14, 98, 182, 38, 3, 3, 'D');

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('CUMULATIVE DOSIMETRIC EXPOSURE:', 20, 108);

    doc.setFontSize(22);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(28, 30, 33);
    doc.text(`${scan.dose || 0.0} ppm·h`, 20, 122);

    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Measurement Uncertainty: +/- ${scan.uncertainty || 1.4} ppm·h | Scan Quality: ${scan.quality || 'Good'}`, 110, 122);

    // Section 3: Occupational Safety Assessment
    doc.setTextColor(28, 30, 33);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('3. Occupational Safety Compliance', 14, 148);

    const isExceeded = (scan.dose > 20);
    const statusText = isExceeded ? 'EXCEEDS RECOMMENDED SHIFT ACTION LEVEL (20 ppm·h)' : 'WITHIN PERMISSIBLE SHIFT EXPOSURE LIMIT';

    if (isExceeded) {
      doc.setFillColor(251, 234, 231);
      doc.setTextColor(198, 64, 43);
    } else {
      doc.setFillColor(232, 245, 236);
      doc.setTextColor(47, 158, 82);
    }
    doc.roundedRect(14, 154, 182, 14, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.text(statusText, 20, 163);

    // Disclaimer
    doc.setTextColor(120, 120, 120);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    const disclaimer = 'H2S-Track passive dosimeters measure cumulative exposure over full shifts. They are not emergency gas alarms. In case of immediate gas release, rely on certified real-time multi-gas detectors.';
    doc.text(disclaimer, 14, 182, { maxWidth: 182 });

    // Save PDF
    doc.save(`H2S_Compliance_Certificate_${scan.badgeId || 'Badge'}_${scan.isoDate || 'Record'}.pdf`);
  }
}
