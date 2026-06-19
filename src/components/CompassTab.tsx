import { useCallback, useEffect, useState } from 'react';
import { Card, ErrorBox, SavedBadge } from './ui';
import { calcDipAngle, compassDirName, requestOrientationPermission } from '../utils/sensors';
import { saveRecord } from '../utils/storage';

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
}

function resolveHeading(event: DeviceOrientationEvent): number | null {
  if (event.alpha === null) return null;

  const iosEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
  if (
    typeof iosEvent.webkitCompassHeading !== 'undefined' &&
    iosEvent.webkitCompassHeading !== null
  ) {
    return iosEvent.webkitCompassHeading;
  }
  return 360 - event.alpha;
}

export function CompassTab({ onLiveChange }: CompassTabProps) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<OrientationState>({
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  const [locked, setLocked] = useState<LockedReading | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const alpha = resolveHeading(event);
    if (alpha === null || event.beta === null || event.gamma === null) return;

    setOrientation({
      alpha,
      beta: event.beta,
      gamma: event.gamma,
    });
  }, []);

  // Reset live indicator when component unmounts (tab switch on mobile)
  useEffect(() => {
    return () => {
      onLiveChange(false);
    };
  }, [onLiveChange]);

  useEffect(() => {
    if (!active) return;

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [active, handleOrientation]);

  const startCompass = async () => {
    setError(null);
    if (!('DeviceOrientationEvent' in window)) {
      setError(
        'DeviceOrientationEvent not supported. This sensor requires a phone with a gyroscope/compass — laptops do not have this hardware.',
      );
      return;
    }

    const permission = requestOrientationPermission();
    if (permission) {
      try {
        const state = await permission;
        if (state !== 'granted') {
          setError(
            'Motion sensor permission denied. Enable it in Settings > Safari > Motion & Orientation Access.',
          );
          return;
        }
      } catch (err) {
        setError(
          `Permission request failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }
    }

    setActive(true);
    onLiveChange(true);
  };

  const lockReading = () => {
    const r: LockedReading = {
      direction: Math.round(orientation.alpha),
      directionName: compassDirName(orientation.alpha),
      dipAngle: calcDipAngle(orientation.beta, orientation.gamma),
      timestamp: new Date().toLocaleTimeString(),
    };
    setLocked(r);
    saveRecord('compass', r);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const dipAngle = calcDipAngle(orientation.beta, orientation.gamma);
  const maxOffset = 42;
  const bubbleX = Math.max(
    -maxOffset,
    Math.min(maxOffset, (orientation.gamma / 45) * maxOffset),
  );
  const bubbleY = Math.max(
    -maxOffset,
    Math.min(maxOffset, (orientation.beta / 45) * maxOffset),
  );

  return (
    <Card title="🧭 Compass & Dip Meter">
      <p className="card-desc">
        Uses DeviceOrientationEvent — your phone&apos;s gyroscope/magnetometer.{' '}
        <strong className="highlight-warn">Phone only — laptops do not have these sensors.</strong>
      </p>

      <button
        className="sensor-btn"
        disabled={active}
        onClick={startCompass}
        type="button"
      >
        {active ? '✓ Compass Active — Move Phone' : '🧭 Enable Compass & Tilt Sensor'}
      </button>

      <ErrorBox message={error} />

      {active && (
        <>
          <div className="compass-wrap">
            <div className="compass-dial">
              <span className="compass-label cl-n">N</span>
              <span className="compass-label cl-e">E</span>
              <span className="compass-label cl-s">S</span>
              <span className="compass-label cl-w">W</span>
              <div
                className="compass-needle"
                style={{
                  transform: `translate(-50%, -100%) rotate(${orientation.alpha}deg)`,
                }}
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
                style={{
                  transform: `translate(calc(-50% + ${bubbleX}px), calc(-50% + ${bubbleY}px))`,
                }}
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
              <div className="locked-reading-title">🔒 LOCKED READING — {locked.timestamp}</div>
              <div className="locked-reading-body">
                Dip/DipDir:{' '}
                <strong>
                  {locked.dipAngle}° / {locked.direction}° ({locked.directionName})
                </strong>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
