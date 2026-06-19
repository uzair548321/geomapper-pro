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

  // Stop all tracks and clear live indicator on unmount (tab switch on mobile)
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
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // loadedmetadata fires once real dimensions are known — required on Android Chrome
        // before this event video.videoWidth/videoHeight are 0
        video.addEventListener(
          'loadedmetadata',
          () => {
            console.log('[Camera] stream ready:', video.videoWidth, '×', video.videoHeight);
            setVideoReady(true);
            // Explicit play() call is required on iOS Safari and some Android Chrome versions
            // even though autoPlay is set — play() returns a Promise so it must be caught
            video.play().catch((err) => {
              console.warn('[Camera] play() rejected:', err);
            });
          },
          { once: true },
        );
      }

      setCameraOpen(true);
      onLiveChange(true);
    } catch (err) {
      onLiveChange(false);
      let msg = `Camera access failed: ${err instanceof Error ? err.message : String(err)}`;
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          msg = 'Camera permission denied. Allow camera access in browser settings.';
        } else if (err.name === 'NotFoundError') {
          msg = 'No camera found on this device.';
        } else if (err.name === 'NotReadableError') {
          msg = 'Camera is already in use by another app. Close it and try again.';
        } else if (err.name === 'OverconstrainedError') {
          msg = 'Camera does not support the requested resolution. Try a different camera app setting.';
        }
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

    // Guard: video dimensions are 0 until loadedmetadata fires
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
    // Stream is still running; videoReady stays true so Capture is immediately available
  };

  const showingPreview = photoUrl !== null;

  return (
    <Card title="📷 Field Photo Capture">
      <p className="card-desc">
        Uses navigator.mediaDevices — back camera for field photos. Capture, preview,
        and retake before attaching to a mapping record.
      </p>

      {!cameraOpen && (
        <button
          className="sensor-btn"
          disabled={loading}
          onClick={startCamera}
          type="button"
        >
          {loading ? <Spinner label="Requesting Camera..." /> : '📷 Open Back Camera'}
        </button>
      )}

      <ErrorBox message={error} />

      {cameraOpen && (
        <div style={{ marginTop: 12 }}>
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
      )}
    </Card>
  );
}
