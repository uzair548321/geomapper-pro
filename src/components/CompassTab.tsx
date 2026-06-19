import { useCallback, useEffect, useState } from 'react';
import { Card, ErrorBox, SavedBadge } from './ui';
import { calcDipAngle, compassDirName, requestOrientationPermission } from '../utils/sensors';
import { loadRecords, saveRecord } from '../utils/storage';

interface CompassTabProps {
  onLiveChange: (live: boolean) => void;
}

interface OrientationState {
  alpha: number;
  beta: number;
  gamma: number;
}

interface LockedReading {
  direction: number;
  directionName: string;
  dipAngle: number;
  timestamp: string;
  structureType: string;
  rockType: string;
  quality: string;
  notes: string;
  gps: { latitude: number; longitude: number; accuracy: number } | null;
}

const STRUCTURE_TYPES = [
  'Bedding', 'Foliation', 'Cleavage', 'Jointing', 'Fault',
  'Vein', 'Contact', 'Unconformity', 'Fold Axial Plane', 'Lineation',
];

const ROCK_TYPES = [
  'Sandstone', 'Limestone', 'Shale', 'Granite', 'Basalt',
  'Quartzite', 'Marble', 'Dolomite', 'Conglomerate', 'Siltstone',
  'Mudstone', 'Gneiss', 'Schist', 'Phyllite', 'Slate', 'Other',
];

const QUALITY_OPTIONS = ['A - Excellent', 'B - Good', 'C - Fair', 'D - Poor'];

function resolveHeading(event: DeviceOrientationEvent): number | null {
  if (event.alpha === null) return null;
  const iosEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
  if (typeof iosEvent.webkitCompassHeading !== 'undefined' && iosEvent.webkitCompassHeading !== null) {
    return iosEvent.webkitCompassHeading;
  }
  return 360 - event.alpha;
}

export function CompassTab({ onLiveChange }: CompassTabProps) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<OrientationState>({ alpha: 0, beta: 0, gamma: 0 });
  const [locked, setLocked] = useState<LockedReading | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const [pendingLock, setPendingLock] = useState<{
    direction: number; directionName: string; dipAngle: number; ts: string;
  } | null>(null);
  const [metaStruct, setMetaStruct] = useState('Bedding');
  const [metaRock, setMetaRock] = useState('Sandstone');
  const [metaQuality, setMetaQuality] = useState('B - Good');
  const [metaNotes, setMetaNotes] = useState('');

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const alpha = resolveHeading(event);
    if (alpha === null || event.beta === null || event.gamma === null) return;
    setOrientation({ alpha, beta: event.beta, gamma: event.gamma });
  }, []);

  useEffect(() => {
    return () => { onLiveChange(false); };
  }, [onLiveChange]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => { window.removeEventListener('deviceorientation', handleOrientation, true); };
  }, [active, handleOrientation]);

  const startCompass = async () => {
    setError(null);
    if (!('DeviceOrientationEvent' in window)) {
      setError('DeviceOrientationEvent not supported. This sensor requires a phone with a gyroscope/compass — laptops do not have this hardware.');
      return;
    }
    const permission = requestOrientationPermission();
    if (permission) {
      try {
        const state = await permission;
        if (state !== 'granted') {
          setError('Motion sensor permission denied. Enable it in Settings > Safari > Motion & Orientation Access.');
          return;
        }
      } catch (err) {
        setError(`Permission request failed: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }
    setActive(true);
    onLiveChange(true);
  };

  const lockReading = () => {
    setPendingLock({
      direction: Math.round(orientation.alpha),
      directionName: compassDirName(orientation.alpha),
      dipAngle: calcDipAngle(orientation.beta, orientation.gamma),
      ts: new Date().toLocaleTimeString(),
    });
  };

  const confirmLock = () => {
    if (!pendingLock) return;
    const gpsRecords = loadRecords().filter((r) => r.type === 'gps');
    const lastGpsData = gpsRecords.length > 0
      ? (gpsRecords[gpsRecords.length - 1].data as { latitude: number; longitude: number; accuracy: number })
      : null;
    const gps = lastGpsData
      ? { latitude: lastGpsData.latitude, longitude: lastGpsData.longitude, accuracy: lastGpsData.accuracy }
      : null;

    const record: LockedReading = {
      direction: pendingLock.direction,
      directionName: pendingLock.directionName,
      dipAngle: pendingLock.dipAngle,
      timestamp: pendingLock.ts,
      structureType: metaStruct,
      rockType: metaRock,
      quality: metaQuality,
      notes: metaNotes.trim(),
      gps,
    };
    setLocked(record);
    saveRecord('compass', record);
    setPendingLock(null);
    setMetaNotes('');
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const dipAngle = calcDipAngle(orientation.beta, orientation.gamma);
  const maxOffset = 42;
  const bubbleX = Math.max(-maxOffset, Math.min(maxOffset, (orientation.gamma / 45) * maxOffset));
  const bubbleY = Math.max(-maxOffset, Math.min(maxOffset, (orientation.beta / 45) * maxOffset));

  return (
    <Card title="🧭 Compass & Dip Meter">
      <p className="card-desc">
        Uses DeviceOrientationEvent — your phone&apos;s gyroscope/magnetometer.{' '}
        <strong className="highlight-warn">Phone only — laptops do not have these sensors.</strong>
      </p>

      <button className="sensor-btn" disabled={active} onClick={startCompass} type="button">
        {active ? '✓ Compass Active — Move Phone' : '🧭 Enable Compass & Tilt Sensor'}
      </button>

      <ErrorBox message={error} />

      {active && !pendingLock && (
        <>
          <div className="compass-wrap">
            <div className="compass-dial">
              <span className="compass-label cl-n">N</span>
              <span className="compass-label cl-e">E</span>
              <span className="compass-label cl-s">S</span>
              <span className="compass-label cl-w">W</span>
              <div
                className="compass-needle"
                style={{ transform: `translate(-50%, -100%) rotate(${orientation.alpha}deg)` }}
              />
              <div className="compass-center" />
            </div>
          </div>

          <div className="tilt-grid">
            <div className="tilt-box">
              <div className="tilt-value">{Math.round(orientation.beta)}°</div>
              <div className="tilt-label">Beta (front-back tilt)</div>
            </div>
            <div className="tilt-box">
              <div className="tilt-value">{Math.round(orientation.gamma)}°</div>
              <div className="tilt-label">Gamma (left-right tilt)</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <div className="level-bubble-wrap">
              <div className="level-bubble-ring" />
              <div
                className="level-bubble"
                style={{ transform: `translate(calc(-50% + ${bubbleX}px), calc(-50% + ${bubbleY}px))` }}
              />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-sec)' }}>
              Place phone flat against rock surface — center bubble = surface is level
            </div>
          </div>

          <div className="dip-result">
            <div className="dip-result-label">Joint Dip Direction (Compass Heading)</div>
            <div className="dip-result-value">{Math.round(orientation.alpha)}°</div>
            <div className="dip-result-sub">{compassDirName(orientation.alpha)}</div>
          </div>

          <div className="dip-result blue">
            <div className="dip-result-label">Estimated Dip Angle (Surface Tilt from Horizontal)</div>
            <div className="dip-result-value blue">{dipAngle}°</div>
            <div className="dip-result-sub">Hold phone flat on the rock joint surface</div>
          </div>

          <button className="sensor-btn secondary" onClick={lockReading} type="button">
            📌 Lock This Reading
          </button>

          <SavedBadge show={showSaved} />

          {locked && (
            <div className="locked-reading">
              <div className="locked-reading-title">🔒 LOCKED — {locked.timestamp}</div>
              <div className="locked-reading-body">
                <strong>{locked.structureType}</strong> · {locked.rockType} · Quality:{' '}
                <span style={{ color: locked.quality.startsWith('A') ? '#3aac6e' : locked.quality.startsWith('B') ? '#3a8fc4' : locked.quality.startsWith('C') ? '#c8952a' : '#c43a3a' }}>
                  {locked.quality.charAt(0)}
                </span>
                <br />
                Dip/DipDir:{' '}
                <strong>
                  {locked.dipAngle}° / {locked.direction}° ({locked.directionName})
                </strong>
                {locked.notes
                  ? <><br /><span style={{ color: 'var(--text-sec)', fontSize: 11 }}>{locked.notes}</span></>
                  : null}
                {locked.gps
                  ? <><br /><span style={{ color: 'var(--text-sec)', fontSize: 10 }}>GPS: {locked.gps.latitude.toFixed(5)}, {locked.gps.longitude.toFixed(5)}</span></>
                  : null}
              </div>
            </div>
          )}
        </>
      )}

      {pendingLock && (
        <div className="meta-form">
          <div className="meta-form-header">
            <span>📌 Lock Reading</span>
            <span style={{ color: 'var(--text-sec)', fontSize: 11 }}>
              {pendingLock.dipAngle}° dip / {pendingLock.direction}° ({pendingLock.directionName})
            </span>
          </div>

          <div className="meta-field">
            <label className="meta-label">Structure Type</label>
            <select className="meta-select" value={metaStruct} onChange={(e) => setMetaStruct(e.target.value)}>
              {STRUCTURE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="meta-field">
            <label className="meta-label">Rock Type</label>
            <select className="meta-select" value={metaRock} onChange={(e) => setMetaRock(e.target.value)}>
              {ROCK_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="meta-field">
            <label className="meta-label">Measurement Quality</label>
            <select className="meta-select" value={metaQuality} onChange={(e) => setMetaQuality(e.target.value)}>
              {QUALITY_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="meta-field">
            <label className="meta-label">Notes</label>
            <textarea
              className="meta-textarea"
              value={metaNotes}
              onChange={(e) => setMetaNotes(e.target.value)}
              placeholder="Optional field description, weathering, exposure quality…"
              rows={3}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="sensor-btn" onClick={confirmLock} type="button" style={{ flex: 1 }}>
              ✓ Confirm &amp; Save
            </button>
            <button
              className="sensor-btn secondary"
              onClick={() => setPendingLock(null)}
              type="button"
              style={{ flex: 1, marginTop: 0 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
