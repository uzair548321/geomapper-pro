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
  // Holds the stream until the fresh video element (key='open') has mounted.
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);

  const dbg = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    const line = `${ts} ${msg}`;
    console.log('[Camera]', line);
    setDebugLog((prev) => [...prev.slice(-14), line]);
  }, []);

  // ── Effect 1: unmount / tab-switch cleanup ─────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      onLiveChange(false);
    };
  }, [onLiveChange]);

  // ── Effect 2: assign srcObject to the FRESH video element after it mounts ──
  //
  // Architecture: startCamera() sets cameraOpen=true and pendingStream=stream
  // in one batched React update. That render mounts a brand-new <video key="open">
  // into a fully-visible, correctly-sized wrapper. Only then does this effect fire
  // and assign srcObject — so the video element has NEVER existed in a hidden or
  // zero-size context. This prevents Android Chrome from locking videoWidth/videoHeight
  // to the CSS dimensions (2×2) instead of the stream's real resolution.
  useEffect(() => {
    if (!pendingStream) return;
    const video = videoRef.current;
    if (!video) {
      dbg('pendingStream effect: videoRef.current is null — element not mounted yet');
      return;
    }

    dbg('pendingStream→ clearing stale attrs, assigning srcObject to fresh element');
    // Clear any HTML width/height attributes that could constrain intrinsic size
    video.removeAttribute('width');
    video.removeAttribute('height');
    video.srcObject = pendingStream;
    setPendingStream(null); // prevent re-running
    dbg(`srcObject set. readyState=${video.readyState} ${video.videoWidth}×${video.videoHeight}`);

    let readinessHandled = false;
    const markReady = (source: string) => {
      if (readinessHandled) return;
      readinessHandled = true;
      dbg(`ready via "${source}". ${video.videoWidth}×${video.videoHeight} readyState=${video.readyState}`);
      // Delayed snapshots to detect transient 2×2 vs permanent 2×2
      setTimeout(() => dbg(`+300ms: ${video.videoWidth}×${video.videoHeight} readyState=${video.readyState} paused=${video.paused}`), 300);
      setTimeout(() => dbg(`+600ms: ${video.videoWidth}×${video.videoHeight} readyState=${video.readyState} paused=${video.paused}`), 600);
      setVideoReady(true);
      video.play()
        .then(() => { dbg(`play() resolved. paused=${video.paused}`); })
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
        markReady('timeout-fallback');
      } else {
        dbg(`timeout fallback: videoWidth=0 after 1500ms readyState=${video.readyState} — stalled?`);
      }
    }, 1500);
  }, [pendingStream, dbg]);

  // ── Effect 3: explicit play() call once the wrapper is visible ─────────────
  //
  // Runs after Effect 2 (React executes effects in definition order within a
  // single commit). At this point srcObject is assigned and the element is visible.
  useEffect(() => {
    if (!cameraOpen) return;
    const video = videoRef.current;
    if (!video) return;
    dbg(`cameraOpen→play(). readyState=${video.readyState} ${video.videoWidth}×${video.videoHeight}`);
    video.play()
      .then(() => { dbg(`post-visibility play() resolved. paused=${video.paused}`); })
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

      // Show wrapper (mounts fresh <video key="open">) and queue stream assignment.
      // React batches these two setState calls into one render, so by the time
      // Effect 2 fires, the new video element is already in the visible DOM.
      setCameraOpen(true);
      setPendingStream(stream);
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
    dbg(`capture: ${dataUrl.length} chars (~${Math.round((dataUrl.length * 0.75) / 1024)}KB) dims=${canvas.width}×${canvas.height}`);

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

      {/* Wrapper is display:none before cameraOpen. Safe because the video element
          that receives the stream (key="open") is always mounted into the visible wrapper —
          it never exists inside a hidden/zero-size container. */}
      <div style={cameraOpen ? { marginTop: 12 } : { display: 'none' }}>
        <div className="camera-wrap">
          <video
            key={cameraOpen ? 'open' : 'closed'}
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ display: showingPreview ? 'none' : 'block', border: '5px solid red' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {photoUrl && <img src={photoUrl} alt="Captured field photo" />}
          {!showingPreview && <div className="camera-overlay" />}
          {!showingPreview && (
            <span className="scale-tag">Reference: hold a 1m scale bar in frame</span>
          )}
        </div>

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
