import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, ErrorBox, SavedBadge, Spinner } from './ui';
import { saveRecord } from '../utils/storage';

interface CameraTabProps {
  onLiveChange: (live: boolean) => void;
}

export function CameraTab({ onLiveChange }: CameraTabProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);

  // setDebugLog setter is stable — safe to call from anywhere without stale closure.
  const dbg = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    const line = `${ts} ${msg}`;
    console.log('[Camera]', line);
    setDebugLog((prev) => [...prev.slice(-14), line]);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      onLiveChange(false);
    };
  }, [onLiveChange]);

  // Force play() after camera-wrap becomes visible in the viewport.
  // On some Android Chrome builds, the decoder won't render frames until play() is
  // called while the element has non-zero layout dimensions.
  useEffect(() => {
    if (!cameraOpen) return;
    const video = videoRef.current;
    if (!video) return;
    dbg(`cameraOpen→play(). readyState=${video.readyState} ${video.videoWidth}×${video.videoHeight}`);
    video
      .play()
      .then(() => {
        dbg(`post-visibility play() resolved. paused=${video.paused}`);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        dbg(`post-visibility play() REJECTED: ${msg}`);
      });
  }, [cameraOpen, dbg]);

  const startCamera = async () => {
    setError(null);
    setVideoReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera API not supported on this browser.');
      return;
    }

    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      dbg(`getUserMedia OK. label="${track?.label}"`);
      const s = track?.getSettings();
      dbg(`track: ${s?.width}×${s?.height} @${s?.frameRate?.toFixed(1)}fps facing=${s?.facingMode}`);

      const video = videoRef.current;
      if (!video) {
        dbg('ERROR: videoRef.current is null — element not mounted');
        console.error('[Camera] videoRef.current is null — video element not mounted');
        setError('Internal error: video element unavailable. Please reload.');
        setLoading(false);
        return;
      }

      dbg('assigning srcObject...');
      video.srcObject = stream;
      dbg(`srcObject set. readyState=${video.readyState} ${video.videoWidth}×${video.videoHeight}`);

      let readinessHandled = false;
      const markReady = (source: string) => {
        if (readinessHandled) return;
        readinessHandled = true;
        dbg(`ready via "${source}". ${video.videoWidth}×${video.videoHeight} readyState=${video.readyState}`);
        setVideoReady(true);
        video
          .play()
          .then(() => {
            dbg(`play() resolved. paused=${video.paused}`);
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            dbg(`play() REJECTED: ${msg}`);
            console.warn('[Camera] play() rejected:', err);
          });
      };

      video.addEventListener(
        'loadedmetadata',
        () => {
          dbg(`evt:loadedmetadata ${video.videoWidth}×${video.videoHeight} readyState=${video.readyState}`);
          markReady('loadedmetadata');
        },
        { once: true },
      );
      video.addEventListener(
        'loadeddata',
        () => {
          dbg(`evt:loadeddata ${video.videoWidth}×${video.videoHeight} readyState=${video.readyState}`);
          markReady('loadeddata');
        },
        { once: true },
      );
      video.addEventListener(
        'canplay',
        () => {
          dbg(`evt:canplay ${video.videoWidth}×${video.videoHeight} readyState=${video.readyState}`);
          markReady('canplay');
        },
        { once: true },
      );

      setTimeout(() => {
        if (readinessHandled) return;
        if (video.videoWidth > 0) {
          dbg(`timeout fallback. videoWidth=${video.videoWidth} readyState=${video.readyState}`);
          console.warn('[Camera] timeout fallback triggered');
          markReady('timeout-fallback');
        } else {
          dbg(`timeout fallback: videoWidth=0 after 1500ms readyState=${video.readyState} — stalled?`);
          console.warn('[Camera] timeout fallback: videoWidth still 0 after 1500ms — stream may be stalled');
        }
      }, 1500);

      setCameraOpen(true);
      onLiveChange(true);
    } catch (err) {
      onLiveChange(false);
      let msg = `Camera access failed: ${err instanceof Error ? err.message : String(err)}`;
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError')      msg = 'Camera permission denied. Allow camera access in browser settings.';
        if (err.name === 'NotFoundError')        msg = 'No camera found on this device.';
        if (err.name === 'NotReadableError')     msg = 'Camera is in use by another app. Close it and try again.';
        if (err.name === 'OverconstrainedError') msg = 'Camera does not support the requested resolution.';
      }
      dbg(`ERROR: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera not ready yet — wait for the preview to appear before capturing.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    dbg(`capture: ${dataUrl.length} chars (~${Math.round((dataUrl.length * 0.75) / 1024)}KB)`);

    setPhotoUrl(dataUrl);

    const sizeKb = Math.round((dataUrl.length * 0.75) / 1024);
    setPhotoMeta(
      `${canvas.width}×${canvas.height}px, ~${sizeKb}KB — captured ${new Date().toLocaleTimeString()}`,
    );
    saveRecord('camera', {
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      sizeKb,
      timestamp: new Date().toISOString(),
    });
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const retakePhoto = () => {
    setPhotoUrl(null);
    setPhotoMeta(null);
    // Stream still running; videoReady stays true — Capture available immediately
  };

  const showingPreview = photoUrl !== null;

  return (
    <Card title="📷 Field Photo Capture">
      <p className="card-desc">
        Uses navigator.mediaDevices — back camera for field photos. Capture, preview,
        and retake before attaching to a mapping record.
      </p>

      {!cameraOpen && (
        <button className="sensor-btn" disabled={loading} onClick={startCamera} type="button">
          {loading ? <Spinner label="Requesting Camera..." /> : '📷 Open Back Camera'}
        </button>
      )}

      <ErrorBox message={error} />

      {/*
        position:absolute + top:-110vw keeps the video off-screen (instead of height:0)
        so the video element has real layout dimensions during stream initialization.
        height:0 + overflow:hidden caused Android Chrome to skip GPU texture allocation,
        producing black frames even when the stream was active and videoWidth > 0.
      */}
      <div
        style={
          cameraOpen
            ? { marginTop: 12 }
            : { position: 'absolute', top: '-110vw', left: 0, width: '100%', pointerEvents: 'none', opacity: 0 }
        }
      >
        <div className="camera-wrap">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ display: showingPreview ? 'none' : 'block', border: '5px solid red' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {photoUrl && <img src={photoUrl} alt="Captured field photo" />}
          {cameraOpen && !showingPreview && <div className="camera-overlay" />}
          {cameraOpen && !showingPreview && (
            <span className="scale-tag">Reference: hold a 1m scale bar in frame</span>
          )}
        </div>

        {cameraOpen && (
          <>
            <div className="camera-controls">
              {!showingPreview ? (
                <button
                  className="sensor-btn"
                  onClick={takePhoto}
                  type="button"
                  disabled={!videoReady}
                >
                  {videoReady ? '📸 Capture' : '⏳ Waiting for camera…'}
                </button>
              ) : (
                <button className="sensor-btn secondary" onClick={retakePhoto} type="button">
                  ↺ Retake
                </button>
              )}
            </div>
            <SavedBadge show={showSaved} />
            {photoMeta && (
              <div className="photo-meta">
                <strong style={{ color: 'var(--text-pri)' }}>Photo captured</strong> — {photoMeta}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── On-screen debug panel ── */}
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={() => setDebugOpen((o) => !o)}
          style={{
            width: '100%',
            padding: '6px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-sec)',
            fontSize: 11,
            fontFamily: 'inherit',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {debugOpen ? '▲' : '▼'} Debug Log ({debugLog.length} lines)
        </button>

        {debugOpen && (
          <>
            <div
              style={{
                marginTop: 4,
                background: '#0a0c0f',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 8,
                maxHeight: 220,
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: 10,
                color: '#a0f0a0',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {debugLog.length === 0
                ? '— no log entries yet —'
                : debugLog.map((line, i) => <div key={i}>{line}</div>)}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(debugLog.join('\n')).catch(() => {});
              }}
              style={{
                marginTop: 4,
                width: '100%',
                padding: '6px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-sec)',
                fontSize: 11,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              📋 Copy Debug Log
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
