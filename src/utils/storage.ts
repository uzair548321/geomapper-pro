export type RecordType = 'gps' | 'compass' | 'camera';

export interface GeoRecord {
  id: string;
  timestamp: number;
  type: RecordType;
  data: unknown;
}

const STORAGE_KEY = 'geomapper_records';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function saveRecord(type: RecordType, data: unknown): void {
  try {
    const existing = loadRecords();
    existing.push({ id: generateId(), timestamp: Date.now(), type, data });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Quota exceeded or storage unavailable
  }
}

export function loadRecords(): GeoRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GeoRecord[]) : [];
  } catch {
    return [];
  }
}

export function deleteRecord(id: string): void {
  try {
    const existing = loadRecords().filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Quota exceeded or storage unavailable
  }
}
