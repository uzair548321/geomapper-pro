import { useEffect, useState } from 'react';
import { Card } from './ui';
import { deleteRecord, loadRecords, type GeoRecord } from '../utils/storage';

interface CompassData {
  direction?: number;
  directionName?: string;
  dipAngle?: number;
  timestamp?: string;
  structureType?: string;
  rockType?: string;
  quality?: string;
  notes?: string;
  gps?: { latitude: number; longitude: number; accuracy: number } | null;
}

interface GpsData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
}

interface CameraData {
  width: number;
  height: number;
  sizeKb: number;
  timestamp: string;
}

const QUALITY_COLORS: Record<string, string> = {
  'A - Excellent': '#3aac6e',
  'B - Good':      '#3a8fc4',
  'C - Fair':      '#c8952a',
  'D - Poor':      '#c43a3a',
};

function qualityColor(q: string): string {
  return QUALITY_COLORS[q] ?? '#8a96a8';
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function RecordsTab() {
  const [records, setRecords] = useState<GeoRecord[]>([]);
  const [filter, setFilter] = useState<string>('All');

  const refresh = () => {
    setRecords(loadRecords().slice().reverse()); // newest first
  };

  useEffect(() => { refresh(); }, []);

  const handleDelete = (id: string) => {
    deleteRecord(id);
    refresh();
  };

  // Derive filter list dynamically from structure types in saved compass records
  const structureTypes = [
    'All',
    ...new Set(
      records
        .filter((r) => r.type === 'compass')
        .map((r) => (r.data as CompassData).structureType ?? 'Unknown')
    ),
  ];

  const filtered =
    filter === 'All'
      ? records
      : records.filter(
          (r) => r.type === 'compass' && (r.data as CompassData).structureType === filter,
        );

  return (
    <Card title="📋 Field Records">
      <p className="card-desc">
        All saved observations — GPS fixes, structural measurements, and photos.
        {records.length > 0 ? ` ${records.length} total record${records.length !== 1 ? 's' : ''}.` : ''}
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {structureTypes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`filter-btn${filter === t ? ' active' : ''}`}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={refresh}
          style={{
            marginLeft: 'auto', background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-sec)', borderRadius: 4, padding: '3px 10px',
            fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ↻
        </button>
      </div>

      {filtered.length === 0 && (
        <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
          {records.length === 0
            ? 'No records yet. Capture GPS, compass, or camera data first.'
            : 'No records match the selected filter.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            onDelete={() => handleDelete(record.id)}
            qualityColor={qualityColor}
            shortDate={shortDate}
          />
        ))}
      </div>
    </Card>
  );
}

interface RecordCardProps {
  record: GeoRecord;
  onDelete: () => void;
  qualityColor: (q: string) => string;
  shortDate: (ts: number) => string;
}

function RecordCard({ record, onDelete, qualityColor, shortDate }: RecordCardProps) {
  const date = shortDate(record.timestamp);

  if (record.type === 'compass') {
    const d = record.data as CompassData;
    const qColor = d.quality ? qualityColor(d.quality) : '#8a96a8';
    return (
      <div className="record-card">
        <div className="record-card-head">
          <span className="record-type-badge">🧭 {d.structureType ?? 'Compass'}</span>
          {d.quality && (
            <span className="record-quality-badge" style={{ color: qColor, borderColor: qColor }}>
              {d.quality.charAt(0)}
            </span>
          )}
          <button onClick={onDelete} className="record-delete-btn" type="button" title="Delete record">✕</button>
        </div>
        <div className="record-card-body">
          <div className="record-row">
            <span className="record-label">Dip / Dir</span>
            <span className="record-value">{d.dipAngle ?? '—'}° / {d.direction ?? '—'}° ({d.directionName ?? ''})</span>
          </div>
          {d.rockType && (
            <div className="record-row">
              <span className="record-label">Rock</span>
              <span className="record-value">{d.rockType}</span>
            </div>
          )}
          {d.gps && (
            <div className="record-row">
              <span className="record-label">GPS</span>
              <span className="record-value" style={{ fontSize: 10 }}>
                {d.gps.latitude.toFixed(5)}, {d.gps.longitude.toFixed(5)} ±{d.gps.accuracy.toFixed(0)}m
              </span>
            </div>
          )}
          {d.notes && <div className="record-notes">{d.notes}</div>}
          <div className="record-timestamp">{d.timestamp ?? ''} · {date}</div>
        </div>
      </div>
    );
  }

  if (record.type === 'gps') {
    const d = record.data as GpsData;
    return (
      <div className="record-card">
        <div className="record-card-head">
          <span className="record-type-badge">📍 GPS Fix</span>
          <button onClick={onDelete} className="record-delete-btn" type="button" title="Delete record">✕</button>
        </div>
        <div className="record-card-body">
          <div className="record-row">
            <span className="record-label">Coordinates</span>
            <span className="record-value">{d.latitude.toFixed(5)}, {d.longitude.toFixed(5)}</span>
          </div>
          <div className="record-row">
            <span className="record-label">Accuracy</span>
            <span className="record-value">±{d.accuracy.toFixed(1)} m</span>
          </div>
          {d.altitude !== null && (
            <div className="record-row">
              <span className="record-label">Altitude</span>
              <span className="record-value">{d.altitude?.toFixed(1)} m</span>
            </div>
          )}
          <div className="record-timestamp">{date}</div>
        </div>
      </div>
    );
  }

  if (record.type === 'camera') {
    const d = record.data as CameraData;
    return (
      <div className="record-card">
        <div className="record-card-head">
          <span className="record-type-badge">📷 Photo</span>
          <button onClick={onDelete} className="record-delete-btn" type="button" title="Delete record">✕</button>
        </div>
        <div className="record-card-body">
          <div className="record-row">
            <span className="record-label">Dimensions</span>
            <span className="record-value">{d.width}×{d.height}px</span>
          </div>
          <div className="record-row">
            <span className="record-label">Size</span>
            <span className="record-value">~{d.sizeKb} KB</span>
          </div>
          <div className="record-timestamp">{date}</div>
        </div>
      </div>
    );
  }

  return null;
}
