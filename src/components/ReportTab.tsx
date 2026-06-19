import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Card, ErrorBox } from './ui';
import { loadRecords, type GeoRecord } from '../utils/storage';

function latestOf(records: GeoRecord[], type: GeoRecord['type']): GeoRecord | null {
  const hits = records.filter((r) => r.type === type);
  return hits.length ? hits[hits.length - 1] : null;
}

type GpsData     = { latitude: number; longitude: number; accuracy: number; altitude: number | null; timestamp: number };
type CompassData = { direction: number; directionName: string; dipAngle: number; timestamp: string };
type CameraData  = { dataUrl: string; width: number; height: number; sizeKb: number; timestamp: string };

export function ReportTab() {
  const [error, setError] = useState<string | null>(null);

  const exportPdf = () => {
    setError(null);

    const records = loadRecords();
    if (!records.length) {
      setError('No saved records found. Capture GPS, compass, or camera data in the other tabs first.');
      return;
    }

    const gps     = latestOf(records, 'gps');
    const compass = latestOf(records, 'compass');
    const camera  = latestOf(records, 'camera');
    const now = new Date();

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W  = doc.internal.pageSize.getWidth();
    const H  = doc.internal.pageSize.getHeight();
    const M  = 14;
    const CW = W - M * 2; // 182mm

    // ── Header bar ───────────────────────────────────────────────
    doc.setFillColor(15, 17, 20);
    doc.rect(0, 0, W, 40, 'F');

    // Left gold accent strip
    doc.setFillColor(200, 149, 42);
    doc.rect(0, 0, 4, 40, 'F');

    // Gold bottom border
    doc.setFillColor(200, 149, 42);
    doc.rect(0, 38, W, 2, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(232, 234, 240);
    doc.text('GeoMapper Pro', M + 2, 17);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(138, 150, 168);
    doc.text('Field Sensor Record', M + 2, 25);

    // Date / time
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
    });
    doc.setFontSize(8);
    doc.text(`${dateStr}  ·  ${now.toLocaleTimeString()}`, M + 2, 33);

    let y = 54;

    // ── Helpers ──────────────────────────────────────────────────
    const sectionHead = (title: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(200, 149, 42);
      doc.text(title, M, y);
      const tw = doc.getTextWidth(title);
      doc.setDrawColor(200, 149, 42);
      doc.setLineWidth(0.35);
      doc.line(M + tw + 3, y - 0.8, M + CW, y - 0.8);
      y += 9;
    };

    const field = (label: string, value: string, x: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(110, 118, 132);
      doc.text(label.toUpperCase(), x, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(18, 20, 28);
      doc.text(value, x, y + 6.5);
    };

    const row2 = (a: [string, string], b: [string, string]) => {
      field(a[0], a[1], M);
      field(b[0], b[1], M + CW / 2);
      y += 16;
    };

    // ── GPS Section ──────────────────────────────────────────────
    if (gps) {
      const d = gps.data as GpsData;
      let accTag = 'VERY POOR';
      if (d.accuracy <= 10) accTag = 'EXCELLENT';
      else if (d.accuracy <= 25) accTag = 'GOOD';
      else if (d.accuracy <= 50) accTag = 'FAIR';
      else if (d.accuracy <= 100) accTag = 'POOR';

      sectionHead('GPS LOCATION');
      row2(['Latitude',  `${d.latitude.toFixed(6)}°`],
           ['Longitude', `${d.longitude.toFixed(6)}°`]);
      row2(['Accuracy',  `${d.accuracy.toFixed(1)} m  (${accTag})`],
           ['Altitude',  d.altitude !== null ? `${d.altitude.toFixed(1)} m` : 'N/A']);
      row2(['Captured',  new Date(d.timestamp).toLocaleTimeString()],
           ['Record ID', gps.id.slice(-8).toUpperCase()]);
      y += 6;
    }

    // ── Compass Section ──────────────────────────────────────────
    if (compass) {
      const d = compass.data as CompassData;

      sectionHead('COMPASS & DIP MEASUREMENT');
      row2(['Dip Direction', `${d.direction}°`],
           ['Direction Name', d.directionName]);
      row2(['Dip Angle', `${d.dipAngle}°`],
           ['Locked At', d.timestamp]);
      y += 6;
    }

    // ── Camera Section ───────────────────────────────────────────
    if (camera) {
      const d = camera.data as CameraData;

      sectionHead('FIELD PHOTO');

      const aspect = d.height / d.width;
      const imgW = CW;
      const imgH = Math.min(imgW * aspect, 80);
      const finalW = imgH / aspect;

      try {
        doc.addImage(d.dataUrl, 'JPEG', M, y, finalW, imgH);
        y += imgH + 4;
      } catch {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(196, 58, 58);
        doc.text('(Photo could not be embedded)', M, y + 6);
        y += 14;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110, 118, 132);
      doc.text(
        `${d.width}×${d.height}px  ·  ~${d.sizeKb} KB  ·  Captured ${new Date(d.timestamp).toLocaleTimeString()}`,
        M, y,
      );
      y += 10;
    }

    // ── Footer ───────────────────────────────────────────────────
    doc.setFillColor(200, 149, 42);
    doc.rect(0, H - 14, W, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 118, 132);
    doc.text('Generated by GeoMapper Pro', M, H - 8);
    const footerR = `${records.length} record${records.length !== 1 ? 's' : ''}  ·  ${now.toLocaleDateString()}`;
    doc.text(footerR, W - M - doc.getTextWidth(footerR), H - 8);

    doc.save(`geomapper-report-${now.toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <Card title="📄 Export PDF Report">
      <p className="card-desc">
        Generates a professional PDF from your most recent saved GPS, compass, and camera
        records. Capture data in the other tabs first, then export here.
      </p>

      <button className="sensor-btn" onClick={exportPdf} type="button">
        ⬇ Export PDF Report
      </button>

      <ErrorBox message={error} />
    </Card>
  );
}
