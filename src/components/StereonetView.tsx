import { useEffect, useState } from 'react';
import { Card } from './ui';
import { loadRecords } from '../utils/storage';

interface PlaneReading {
  id: string;
  dipDir: number;
  dip: number;
  structureType: string;
  timestamp: string;
}

// SVG canvas constants
const R = 130;   // stereonet radius
const CX = 160;  // center x
const CY = 160;  // center y

// Lambert equal-area (Schmidt) projection.
// plunge: 0=horizontal (equator), 90=vertical (center).
// trend: azimuth in degrees, North=0.
// Returns offset from center in SVG units (East=+x, North=-y).
function schmidtProject(plunge_deg: number, trend_deg: number): { x: number; y: number } {
  const p = (plunge_deg * Math.PI) / 180;
  const t = (trend_deg * Math.PI) / 180;
  const r = R * Math.sqrt(2) * Math.sin((Math.PI / 2 - p) / 2);
  return { x: r * Math.sin(t), y: -r * Math.cos(t) };
}

// SVG path for the great circle arc of a plane.
// Uses lower-hemisphere parametrization: t ∈ [0,π] spans the full arc.
function greatCirclePath(dd_deg: number, d_deg: number, steps = 120): string {
  const dd = (dd_deg * Math.PI) / 180;
  const d  = (d_deg  * Math.PI) / 180;

  // Vectors in (East, North, Up):
  // strike_vec perpendicular to dip direction, horizontal
  const sx = -Math.cos(dd);
  const sy =  Math.sin(dd);
  // down-dip vector
  const dx = Math.sin(dd) * Math.cos(d);
  const dy = Math.cos(dd) * Math.cos(d);
  const dz = -Math.sin(d);

  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t  = (Math.PI * i) / steps;
    const x  = Math.cos(t) * sx + Math.sin(t) * dx;
    const y  = Math.cos(t) * sy + Math.sin(t) * dy;
    const z  = Math.sin(t) * dz; // sz = 0

    const plunge = Math.asin(Math.max(-1, Math.min(1, -z)));
    const trend  = Math.atan2(x, y);
    const rr     = R * Math.sqrt(2) * Math.sin((Math.PI / 2 - plunge) / 2);
    const px     = CX + rr * Math.sin(trend);
    const py     = CY - rr * Math.cos(trend);
    pts.push(i === 0 ? `M${px.toFixed(1)},${py.toFixed(1)}` : `L${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return pts.join(' ');
}

// Pole to the plane (plots opposite to dip direction, at 90-dip from center).
function polePoint(dd_deg: number, d_deg: number): { x: number; y: number } {
  const pt = schmidtProject(90 - d_deg, (dd_deg + 180) % 360);
  return { x: CX + pt.x, y: CY + pt.y };
}

// Equal-area radius for a given plunge (used for grid circles).
function gridR(plunge_deg: number): number {
  const p = (plunge_deg * Math.PI) / 180;
  return R * Math.sqrt(2) * Math.sin((Math.PI / 2 - p) / 2);
}

const STRUCTURE_COLORS: Record<string, string> = {
  Bedding:           '#c8952a',
  Foliation:         '#3a8fc4',
  Cleavage:          '#3aac6e',
  Jointing:          '#e8b84b',
  Fault:             '#c43a3a',
  Vein:              '#b06de8',
  Contact:           '#d95f1a',
  Unconformity:      '#e87070',
  'Fold Axial Plane':'#3ad4ac',
  Lineation:         '#8ab4f8',
};

function structureColor(type: string): string {
  return STRUCTURE_COLORS[type] ?? '#8a96a8';
}

export function StereonetView() {
  const [readings, setReadings] = useState<PlaneReading[]>([]);

  const refresh = () => {
    const planes = loadRecords()
      .filter((r) => r.type === 'compass')
      .map((r) => {
        const d = r.data as {
          direction?: number; dipAngle?: number;
          structureType?: string; timestamp?: string;
        };
        if (d.direction == null || d.dipAngle == null) return null;
        return {
          id: r.id,
          dipDir: d.direction,
          dip: d.dipAngle,
          structureType: d.structureType ?? 'Unknown',
          timestamp: d.timestamp ?? '',
        };
      })
      .filter(Boolean) as PlaneReading[];
    setReadings(planes);
  };

  useEffect(() => { refresh(); }, []);

  const structureTypes = [...new Set(readings.map((r) => r.structureType))];
  const r30 = gridR(30);
  const r60 = gridR(60);

  return (
    <Card title="◎ Stereonet (Schmidt Equal-Area)">
      <p className="card-desc">
        Lower-hemisphere equal-area projection of saved plane readings. Great circles (lines)
        and poles (dots) are plotted per measurement.
      </p>

      <button
        className="sensor-btn secondary"
        onClick={refresh}
        type="button"
        style={{ marginBottom: 12, marginTop: 0 }}
      >
        ↻ Refresh ({readings.length} reading{readings.length !== 1 ? 's' : ''})
      </button>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          width="320"
          height="320"
          viewBox="0 0 320 320"
          style={{ display: 'block', maxWidth: '100%' }}
        >
          <defs>
            <clipPath id="snet-clip">
              <circle cx={CX} cy={CY} r={R} />
            </clipPath>
          </defs>

          {/* Background */}
          <circle cx={CX} cy={CY} r={R} fill="#0a0c0f" />

          {/* Grid: radial lines every 30° */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={CX} y1={CY}
                x2={CX + R * Math.sin(angle)}
                y2={CY - R * Math.cos(angle)}
                stroke="#2a323f" strokeWidth="0.8"
              />
            );
          })}

          {/* Grid: equal-plunge circles at 30° and 60° */}
          <circle cx={CX} cy={CY} r={r30} fill="none" stroke="#2a323f" strokeWidth="0.8" strokeDasharray="4,4" />
          <circle cx={CX} cy={CY} r={r60} fill="none" stroke="#2a323f" strokeWidth="0.8" strokeDasharray="4,4" />

          {/* N/E/S/W labels */}
          <text x={CX}      y={CY - R - 8}  textAnchor="middle" fill="#e8b84b" fontSize="13" fontWeight="700" fontFamily="monospace">N</text>
          <text x={CX + R + 10} y={CY + 5}  textAnchor="start"  fill="#8a96a8" fontSize="11" fontFamily="monospace">E</text>
          <text x={CX}      y={CY + R + 18} textAnchor="middle" fill="#8a96a8" fontSize="11" fontFamily="monospace">S</text>
          <text x={CX - R - 10} y={CY + 5}  textAnchor="end"    fill="#8a96a8" fontSize="11" fontFamily="monospace">W</text>

          {/* Readings: great circles + poles, clipped to primitive circle */}
          <g clipPath="url(#snet-clip)">
            {readings.map((r) => {
              const color = structureColor(r.structureType);
              const pole  = polePoint(r.dipDir, r.dip);
              return (
                <g key={r.id}>
                  <path
                    d={greatCirclePath(r.dipDir, r.dip)}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeOpacity="0.85"
                  />
                  <circle cx={pole.x} cy={pole.y} r="4.5" fill={color} fillOpacity="0.9" />
                </g>
              );
            })}
          </g>

          {/* Primitive circle outline on top */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#4a5568" strokeWidth="1.5" />
        </svg>
      </div>

      {readings.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, marginTop: 8 }}>
          No compass readings saved yet. Lock readings in the Compass tab to plot them here.
        </div>
      )}

      {structureTypes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Legend
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
            {structureTypes.map((type) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-pri)' }}>
                <span
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: structureColor(type), display: 'inline-block', flexShrink: 0,
                  }}
                />
                {type}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
