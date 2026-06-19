export type TabId = 'gps' | 'compass' | 'camera' | 'stereonet' | 'records' | 'export' | 'diag' | 'report';

export interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

export const TABS: TabConfig[] = [
  { id: 'gps',       label: 'GPS',        icon: '📍' },
  { id: 'compass',   label: 'Compass',    icon: '🧭' },
  { id: 'camera',    label: 'Camera',     icon: '📷' },
  { id: 'stereonet', label: 'Stereonet',  icon: '◎' },
  { id: 'records',   label: 'Records',    icon: '📋' },
  { id: 'export',    label: 'Export',     icon: '⬇' },
  { id: 'diag',      label: 'Diag',       icon: '⚙' },
  { id: 'report',    label: 'PDF',        icon: '📄' },
];

export interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
}

export interface AccuracyInfo {
  color: string;
  tag: string;
}

export function accuracyInfo(accuracy: number): AccuracyInfo {
  if (accuracy <= 10) return { color: '#3aac6e', tag: 'EXCELLENT' };
  if (accuracy <= 25) return { color: '#3a8fc4', tag: 'GOOD' };
  if (accuracy <= 50) return { color: '#c8952a', tag: 'FAIR' };
  if (accuracy <= 100) return { color: '#d95f1a', tag: 'POOR' };
  return { color: '#c43a3a', tag: 'VERY POOR' };
}

export function buildMapEmbedUrl(latitude: number, longitude: number): string {
  const delta = 0.003;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function compassDirName(deg: number): string {
  const dirs = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function calcDipAngle(beta: number, gamma: number): number {
  return Math.min(90, Math.round(Math.sqrt(beta * beta + gamma * gamma)));
}

export function isSecureContext(): boolean {
  return (
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1'
  );
}

export function requestOrientationPermission(): Promise<'granted' | 'denied'> | null {
  const ctor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (typeof ctor.requestPermission === 'function') {
    return ctor.requestPermission();
  }
  return null;
}

export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export interface SensorDiagnostics {
  geolocation: boolean;
  deviceOrientation: boolean;
  camera: boolean;
  isHttps: boolean;
  deviceType: 'Mobile' | 'Desktop/Laptop';
  userAgent: string;
}

export function runDiagnostics(): SensorDiagnostics {
  return {
    geolocation: 'geolocation' in navigator,
    deviceOrientation: 'DeviceOrientationEvent' in window,
    camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    isHttps: isSecureContext(),
    deviceType: isMobileDevice() ? 'Mobile' : 'Desktop/Laptop',
    userAgent: navigator.userAgent,
  };
}
