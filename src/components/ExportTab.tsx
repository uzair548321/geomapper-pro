import { useEffect, useState } from 'react';
import { Card } from './ui';
import { loadRecords, type GeoRecord } from '../utils/storage';

interface CompassData {
  direction?: number;
  directionName?: string;
  dipAngle?: number;
  timestamp?: string;
  structureType?: string;
  rockType?: string;
  quality?: string;
  notes?: string;
  gps?: { latitude?: number; longitude?: number; accuracy?: number } | null;
}

interface GpsData {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  altitude?: number | null;
}

interface CameraData {
  width?: number;
  height?: number;
  sizeKb?: number;
}

const CSV_HEADERS = [
  'timestamp', 'type', 'structure', 'rock_type',
  'dip', 'dip_direction', 'latitude', 'longitude', 'quality', 'notes',
];

const TABLE_HEADERS = [
  'Time', 'Type', 'Structure', 'Rock', 'Dip', 'DipDir', 'Lat', 'Lon', 'Quality', 'Notes',
];

function recordToRow(r: GeoRecord): string[] {
  const ts = new Date(r.timestamp).toISOString();
  if (r.type === 'compass') {
    const d = r.data as CompassData;
    return [
      ts, 'compass',
      d.structureType ?? '', d.rockType ?? '',
      String(d.dipAngle ?? ''), String(d.direction ?? ''),
      String(d.gps?.latitude ?? ''), String(d.gps?.longitude ?? ''),
      d.quality ?? '', d.notes ?? '',
    ];
  }
  if (r.type === 'gps') {
    const d = r.data as GpsData;
    return [ts, 'gps', '', '', '', '', String(d.latitude ?? ''), String(d.longitude ?? ''), '', ''];
  }
  if (r.type === 'camera') {
    const d = r.data as CameraData;
    return [ts, 'camera', '', '', '', '', '', '', '', `${d.width}×${d.height} ~${d.sizeKb}KB`];
  }
  return [ts, r.type, '', '', '', '', '', '', '', ''];
}

function buildCsv(records: GeoRecord[]): string {
  const rows = [CSV_HEADERS, ...records.map(recordToRow)];
  return rows.map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
}

function buildTxt(records: GeoRecord[]): string {
  const lines: string[] = [
    'GeoMapper Pro — Field Report',
    '='.repeat(44),
    `Exported: ${new Date().toLocaleString()}`,
    `Records:  ${records.length}`,
    '',
  ];
  for (const r of records) {
    const ts = new Date(r.timestamp).toLocaleString();
    if (r.type === 'compass') {
      const d = r.data as CompassData;
      lines.push(`[STRUCTURAL MEASUREMENT]  ${ts}`);
      lines.push(`  Structure:  ${d.structureType ?? '—'}  |  Rock: ${d.rockType ?? '—'}  |  Quality: ${d.quality ?? '—'}`);
      lines.push(`  Dip: ${d.dipAngle ?? '—'}°  /  Dip Direction: ${d.direction ?? '—'}° (${d.directionName ?? ''})`);
      if (d.gps?.latitude != null) {
        lines.push(`  GPS: ${d.gps.latitude.toFixed(5)}, ${d.gps.longitude?.toFixed(5)}  ±${d.gps.accuracy?.toFixed(0)}m`);
      }
      if (d.notes) lines.push(`  Notes: ${d.notes}`);
    } else if (r.type === 'gps') {
      const d = r.data as GpsData;
      lines.push(`[GPS FIX]  ${ts}`);
      lines.push(`  Lat: ${d.latitude?.toFixed(6)}  Lon: ${d.longitude?.toFixed(6)}  Accuracy: ±${d.accuracy?.toFixed(1)}m`);
      if (d.altitude != null) lines.push(`  Altitude: ${d.altitude?.toFixed(1)}m`);
    } else if (r.type === 'camera') {
      const d = r.data as CameraData;
      lines.push(`[PHOTO]  ${ts}`);
      lines.push(`  Dimensions: ${d.width}×${d.height}px  ~${d.sizeKb}KB`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function shortTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function ExportTab() {
  const [records, setRecords] = useState<GeoRecord[]>([]);

  const refresh = () => setRecords(loadRecords());
  useEffect(() => { refresh(); }, []);

  const tag = `${Date.now()}`;
  const exportCsv = () => download(buildCsv(records), `geomapper-${tag}.csv`, 'text/csv');
  const exportTxt = () => download(buildTxt(records), `geomapper-${tag}.txt`, 'text/plain');

  const preview = records.slice(-5).reverse();

  return (
    <Card title="⬇ Data Export">
      <p className="card-desc">
        Export all field records as a CSV (spreadsheet-ready) or a plain-text field report.
        {records.length > 0
          ? ` ${records.length} record${records.length !== 1 ? 's' : ''} saved.`
          : ' No records saved yet.'}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className="sensor-btn"
          onClick={exportCsv}
          type="button"
          disabled={!records.length}
          style={{ flex: 1 }}
        >
          ⬇ Export CSV
        </button>
        <button
          className="sensor-btn secondary"
          onClick={exportTxt}
          type="button"
          disabled={!records.length}
          style={{ flex: 1, marginTop: 0 }}
        >
          ⬇ Export TXT
        </button>
      </div>

      {preview.length > 0 && (
        <>
          <div style={{
            fontSize: 10, color: 'var(--text-sec)', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Preview — last {preview.length} record{preview.length !== 1 ? 's' : ''}
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid var(--border)' }}>
            <table className="export-table">
              <thead>
                <tr>{TABLE_HEADERS.map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((r, i) => {
                  const row = recordToRow(r);
                  row[0] = shortTime(r.timestamp); // replace ISO ts with human-readable
                  return (
                    <tr key={i}>
                      {row.map((cell, j) => <td key={j}>{cell}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
