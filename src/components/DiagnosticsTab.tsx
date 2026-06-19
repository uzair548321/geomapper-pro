import { Card } from './ui';
import { runDiagnostics, type SensorDiagnostics } from '../utils/sensors';

function statusClass(ok: boolean): string {
  return ok ? 'info-value ok' : 'info-value fail';
}

function statusText(ok: boolean, label: string): string {
  return ok ? label : `NOT ${label}`;
}

export function DiagnosticsTab() {
  const diag: SensorDiagnostics = runDiagnostics();

  return (
    <>
      <Card title="⚙ Sensor Diagnostics">
        <div className="diag-box">
          <div className="info-row">
            <span className="info-label">Geolocation API</span>
            <span className={statusClass(diag.geolocation)}>
              {statusText(diag.geolocation, 'Supported')}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">DeviceOrientation API</span>
            <span className={statusClass(diag.deviceOrientation)}>
              {statusText(diag.deviceOrientation, 'Supported')}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Camera API (getUserMedia)</span>
            <span className={statusClass(diag.camera)}>
              {statusText(diag.camera, 'Supported')}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Protocol (HTTPS)</span>
            <span className={statusClass(diag.isHttps)}>
              {(diag.isHttps ? 'Secure ✓ ' : 'INSECURE ✗ ') +
                `(${location.protocol})`}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Device Type</span>
            <span className="info-value">{diag.deviceType}</span>
          </div>
          <div className="info-row">
            <span className="info-label">User Agent</span>
            <span className="info-value ua">{diag.userAgent}</span>
          </div>
        </div>
      </Card>

      <Card title="🛠 For Developers">
        <p className="dev-note">
          <strong>This app uses only native browser APIs</strong> — no external sensor
          libraries. Open browser DevTools Console (F12) to inspect raw sensor events.
          <br />
          <br />
          <strong className="warn">HTTPS required:</strong> Geolocation, device orientation,
          and camera are blocked on plain HTTP or file:// URLs. Deploy to Vercel/Netlify for
          a free HTTPS domain, or test on{' '}
          <code>localhost</code>.
          <br />
          <br />
          <strong className="warn">iOS 13+ note:</strong> Safari requires an explicit
          permission prompt for DeviceOrientationEvent — handled via{' '}
          <code>requestPermission()</code> on the Compass/Dip tab.
        </p>
      </Card>
    </>
  );
}
