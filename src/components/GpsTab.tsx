import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, ErrorBox, SavedBadge, Spinner } from './ui';
import {
  accuracyInfo,
  buildMapEmbedUrl,
  type GpsReading,
  isSecureContext,
} from '../utils/sensors';
import { saveRecord } from '../utils/storage';

interface GpsTabProps {
  onLiveChange: (live: boolean) => void;
}

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

export function GpsTab({ onLiveChange }: GpsTabProps) {
  const [reading, setReading] = useState<GpsReading | null>(null);
  const [error, setError] = useState<string | null>(
    isSecureContext()
      ? null
      : `Sensors require HTTPS. This page is on ${location.protocol} — deploy to Vercel/Netlify or use localhost for full sensor access.`,
  );
  const [loading, setLoading] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  // Ref mirrors watchId so the unmount cleanup always sees the current value (avoids stale closure)
  const watchIdRef = useRef<number | null>(null);

  // Clear any active watch and reset live indicator when tab is left / component unmounts
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      onLiveChange(false);
    };
  }, [onLiveChange]);

  const applyPosition = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, altitude } = position.coords;
      setReading({
        latitude,
        longitude,
        accuracy,
        altitude,
        timestamp: position.timestamp,
      });
      onLiveChange(true);
      setError(null);
    },
    [onLiveChange],
  );

  const handleGpsError = useCallback(
    (err: GeolocationPositionError) => {
      onLiveChange(false);
      let msg = `Unknown error: ${err.message}`;
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Location permission denied. Allow it in browser settings.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = 'Location unavailable. Try a different spot.';
      } else if (err.code === err.TIMEOUT) {
        msg = 'GPS timed out. Try again outdoors.';
      }
      setError(msg);
    },
    [onLiveChange],
  );

  const captureLocation = () => {
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported on this device.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyPosition(pos);
        saveRecord('gps', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          timestamp: pos.timestamp,
        });
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
        setLoading(false);
      },
      (err) => {
        handleGpsError(err);
        setLoading(false);
      },
      GPS_OPTIONS,
    );
  };

  const toggleWatch = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchIdRef.current = null;
      setWatchId(null);
      setWatching(false);
      onLiveChange(!!reading);
      return;
    }
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported on this device.');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      applyPosition,
      handleGpsError,
      GPS_OPTIONS,
    );
    watchIdRef.current = id;
    setWatchId(id);
    setWatching(true);
  };

  const acc = reading ? accuracyInfo(reading.accuracy) : null;
  const mapUrl = reading
    ? buildMapEmbedUrl(reading.latitude, reading.longitude)
    : '';

  return (
    <Card title="📍 Live GPS Location">
      <p className="card-desc">
        Uses navigator.geolocation — your device&apos;s real GPS chip via the browser.
        Phone: ~3–10m accuracy. Laptop: WiFi-based, ~50–500m.
      </p>

      <button
        className="sensor-btn"
        disabled={loading}
        onClick={captureLocation}
        type="button"
      >
        {loading ? <Spinner label="Acquiring GPS..." /> : '📡 Capture GPS Location'}
      </button>

      <button className="sensor-btn secondary" onClick={toggleWatch} type="button">
        {watching ? '⏸ Stop Live Tracking' : '▶ Start Live Tracking'}
      </button>

      <SavedBadge show={showSaved} />
      <ErrorBox message={error} />

      {reading && (
        <div style={{ marginTop: 14 }}>
          <div className="coord-grid">
            <div className="coord-box">
              <div className="coord-label">Latitude</div>
              <div className="coord-value">{reading.latitude.toFixed(6)}°</div>
            </div>
            <div className="coord-box">
              <div className="coord-label">Longitude</div>
              <div className="coord-value">{reading.longitude.toFixed(6)}°</div>
            </div>
          </div>
          <div className="coord-grid">
            <div className="coord-box">
              <div className="coord-label">Altitude</div>
              <div className="coord-value small">
                {reading.altitude !== null ? `${reading.altitude.toFixed(1)} m` : 'N/A'}
              </div>
            </div>
            <div className="coord-box">
              <div className="coord-label">Captured</div>
              <div className="coord-value small">
                {new Date(reading.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>

          {acc && (
            <div className="accuracy-bar-wrap">
              <div className="accuracy-label">
                <span>
                  Accuracy{' '}
                  <span className="badge" style={{ color: acc.color }}>
                    {acc.tag}
                  </span>
                </span>
                <span style={{ color: acc.color, fontWeight: 700 }}>
                  {reading.accuracy.toFixed(1)} m
                </span>
              </div>
              <div className="accuracy-bar">
                <div
                  className="accuracy-fill"
                  style={{
                    width: `${Math.min(100, 100 - Math.min(reading.accuracy, 100))}%`,
                    background: acc.color,
                  }}
                />
              </div>
            </div>
          )}

          <div className="map-frame">
            <div className="map-pin">📍</div>
            <iframe src={mapUrl} title="OpenStreetMap location" loading="lazy" />
          </div>
        </div>
      )}
    </Card>
  );
}
