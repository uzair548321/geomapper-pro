import { useRef, useState } from 'react';
import { Card, ErrorBox, SavedBadge } from './ui';
import { saveRecord } from '../utils/storage';

interface CameraTabProps {
  onLiveChange: (live: boolean) => void;
}

export function CameraTab({ onLiveChange }: CameraTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const openCamera = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      const img = new Image();
      img.onload = () => {
        const sizeKb = Math.round((dataUrl.length * 0.75) / 1024);
        setPhotoUrl(dataUrl);
        setPhotoMeta(
          `${img.naturalWidth}×${img.naturalHeight}px, ~${sizeKb}KB — captured ${new Date().toLocaleTimeString()}`,
        );
        saveRecord('camera', {
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeKb,
          timestamp: new Date().toISOString(),
        });
        onLiveChange(true);
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setError('Failed to read the captured photo. Please try again.');
    };
    reader.readAsDataURL(file);

    // Reset input so retake always triggers onChange
    e.target.value = '';
  };

  const retakePhoto = () => {
    setPhotoUrl(null);
    setPhotoMeta(null);
    onLiveChange(false);
    fileInputRef.current?.click();
  };

  return (
    <Card title="📷 Field Photo Capture">
      <p className="card-desc">
        Opens your phone&apos;s native camera app — back camera for field photos. Capture,
        preview, and retake before attaching to a mapping record.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <ErrorBox message={error} />

      {!photoUrl ? (
        <button className="sensor-btn" onClick={openCamera} type="button">
          📷 Open Camera
        </button>
      ) : (
        <>
          <div className="camera-wrap">
            <img src={photoUrl} alt="Captured field photo" />
            <div className="camera-overlay" />
            <span className="scale-tag">Reference: hold a 1m scale bar in frame</span>
          </div>

          <div className="camera-controls">
            <button className="sensor-btn secondary" onClick={retakePhoto} type="button">
              ↺ Retake
            </button>
          </div>

          <SavedBadge show={showSaved} />

          {photoMeta && (
            <div className="photo-meta">
              <strong style={{ color: 'var(--text-pri)' }}>Photo captured</strong> — {photoMeta}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
