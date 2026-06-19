import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      onLiveChange(false);
    };
  }, [onLiveChange]);

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

      // ── Diagnostic logging ──────────────────────────────────────────
      const track = stream.getVideoTracks()[0];
      console.log('[Camera] getUserMedia succeeded. Track label:', track?.label);
      console.log('[Camera] track.getSettings():', track?.getSettings());

      // ── Assign srcObject ────────────────────────────────────────────
      // IMPORTANT: videoRef.current is only non-null here because the <video> element
      // is always in the DOM (rendered unconditionally below, inside a hidden wrapper).
      // Putting <video> inside {cameraOpen && ...} caused cameraOpen=false at this point,
      // so videoRef.current was null and srcObject was never set — the true root cause
      // of "loadedmetadata never fires".
      const video = videoRef.current;
      if (!video) {
        console.error('[Camera] videoRef.current is null — video element not mounted');
        setError('Internal error: video element unavailable. Please reload.');
        setLoading(false);
        return;
      }

      console.log('[Camera] assigning srcObject to video element');
      video.srcObject = stream;

      // ── Readiness detection: three events + hard timeout fallback ───
      // Different Android Chrome versions fire different events for getUserMedia streams.
      // We listen for all three and accept whichever arrives first.
      let readinessHandled = false;
      const markReady = (source: string) => {
        if (readinessHandled) return;
        readinessHandled = true;
        console.log(`[Camera] ready via "${source}" — ${video.videoWidth}×${video.videoHeight}`);
        setVideoReady(true);
        // Explicit play() is required on iOS Safari and some Android Chrome builds
        // because autoPlay alone does not reliably start playback after srcObject is set.
        video.play().catch((err) => console.warn('[Camera] play() rejected:', err));
      };

      video.addEventListener('loadedmetadata', () => markReady('loadedmetadata'), { once: true });
      video.addEventListener('loadeddata',     () => markReady('loadeddata'),     { once: true });
      video.addEventListener('canplay',        () => markReady('canplay'),        { once: true });

      // Hard fallback: some Android Chrome versions populate frames silently without
      // firing any of the above events. Poll videoWidth after 1500ms.
      setTimeout(() => {
        if (readinessHandled) return;
        if (video.videoWidth > 0) {
          console.warn(
            '[Camera] timeout fallback triggered (no events fired). videoWidth:',
            video.videoWidth,
          );
          markReady('timeout-fallback');
        } else {
          console.warn(
            '[Camera] timeout fallback: videoWidth still 0 after 1500ms — stream may be stalled',
          );
        }
      }, 1500);

      setCameraOpen(true);
      onLiveChange(true);
    } catch (err) {
      onLiveChange(false);
      let msg = `Camera access failed: ${err instanceof Error ? err.message : String(err)}`;
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError')   msg = 'Camera permission denied. Allow camera access in browser settings.';
        if (err.name === 'NotFoundError')     msg = 'No camera found on this device.';
        if (err.name === 'NotReadableError')  msg = 'Camera is in use by another app. Close it and try again.';
        if (err.name === 'OverconstrainedError') msg = 'Camera does not support the requested resolution.';
      }
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
        The camera-wrap wrapper is ALWAYS rendered so that <video> is always in the DOM.
        This is critical: startCamera runs before cameraOpen flips to true, so if <video>
        were inside {cameraOpen && ...} the ref would be null and srcObject would never be set.
        We hide the wrapper with visibility+height instead of display:none so the browser
        engine still processes the video stream and fires readiness events.
      */}
      <div
        style={
          cameraOpen
            ? { marginTop: 12 }
            : { visibility: 'hidden', position: 'absolute', height: 0, overflow: 'hidden' }
        }
      >
        <div className="camera-wrap">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ display: showingPreview ? 'none' : 'block' }}
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
    </Card>
  );
}
