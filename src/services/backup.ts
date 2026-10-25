import { db, DB_NAMES, dataMode, type SettingRow } from '@/data/db';
import { todayISO } from '@/domain/dates';

const FORMAT = 'tgli-backup';
const VERSION = 1;

/** Settings rows that must never leave the device (API keys). */
const SECRET_KEYS = new Set(['coach.key']);

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function fromBase64(s: string): ArrayBuffer {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  includesPhotos: boolean;
  tables: Record<string, unknown[]>;
}

export async function buildBackup(includePhotos: boolean): Promise<BackupFile> {
  const [lockIns, checkIns, workouts, measurements, comparisons, milestones, goals, journal, settings, chats, memories, suggestions, coachReports] = await Promise.all([
    db.lockIns.toArray(),
    db.checkIns.toArray(),
    db.workouts.toArray(),
    db.measurements.toArray(),
    db.comparisons.toArray(),
    db.milestones.toArray(),
    db.goals.toArray(),
    db.journal.toArray(),
    db.settings.toArray(),
    db.chats.toArray(),
    db.memories.toArray(),
    db.suggestions.toArray(),
    db.coachReports.toArray(),
  ]);
  const tables: Record<string, unknown[]> = {
    lockIns,
    checkIns,
    workouts,
    measurements,
    comparisons,
    milestones,
    goals,
    journal,
    settings: settings.filter((s) => !SECRET_KEYS.has(s.key)),
    chats,
    memories,
    suggestions,
    coachReports,
  };
  if (includePhotos) {
    const photos = await db.photos.toArray();
    tables.photos = photos.map((p) => ({ ...p, thumb: toBase64(p.thumb) }));
    const blobs: unknown[] = [];
    await db.photoBlobs.each((b) => {
      blobs.push({ id: b.id, data: toBase64(b.data) });
    });
    tables.photoBlobs = blobs;
  }
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), includesPhotos: includePhotos, tables };
}

/** Saves via the share sheet where supported (iOS), otherwise as a download. */
export async function exportBackup(includePhotos: boolean): Promise<'shared' | 'downloaded'> {
  const data = await buildBackup(includePhotos);
  const name = `tgli-backup-${todayISO()}${dataMode === 'demo' ? '-demo' : ''}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: 'TGLI backup' });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

export async function readBackup(file: File): Promise<BackupFile> {
  const text = await file.text();
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (parsed?.format !== FORMAT || typeof parsed.version !== 'number' || !parsed.tables) throw new Error('This is not a TGLI backup file.');
  if (parsed.version > VERSION) throw new Error('This backup was made by a newer version of TGLI.');
  return parsed;
}

/** Replaces all data on this device with the backup's contents. */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  const t = backup.tables;
  const keyRow = await db.settings.get('coach.key');
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((tbl) => tbl.clear()));
    const put = async (name: string, rows: unknown[] | undefined) => {
      if (rows?.length) await db.table(name).bulkPut(rows);
    };
    await put('lockIns', t.lockIns);
    await put('checkIns', t.checkIns);
    await put('workouts', t.workouts);
    await put('measurements', t.measurements);
    await put('comparisons', t.comparisons);
    await put('milestones', t.milestones);
    await put('goals', t.goals);
    await put('journal', t.journal);
    await put('settings', (t.settings as SettingRow[] | undefined)?.filter((s) => !SECRET_KEYS.has(s.key)));
    await put('chats', t.chats);
    await put('memories', t.memories);
    await put('suggestions', t.suggestions);
    await put('coachReports', t.coachReports);
    if (t.photos) await put('photos', (t.photos as { thumb: string }[]).map((p) => ({ ...p, thumb: fromBase64(p.thumb) })));
    if (t.photoBlobs) await put('photoBlobs', (t.photoBlobs as { id: string; data: string }[]).map((b) => ({ id: b.id, data: fromBase64(b.data) })));
    // Keep a locally stored API key; backups never contain one.
    if (keyRow) await db.settings.put(keyRow);
  });
}

export async function deleteEverything(): Promise<void> {
  db.close();
  const { default: Dexie } = await import('dexie');
  await Dexie.delete(DB_NAMES[dataMode]);
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('tgli.') && k !== 'tgli.mode')
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

export async function storageInfo(): Promise<{ usage: number | null; quota: number | null; persisted: boolean | null }> {
  try {
    const [est, persisted] = await Promise.all([navigator.storage?.estimate?.(), navigator.storage?.persisted?.()]);
    return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted: persisted ?? null };
  } catch {
    return { usage: null, quota: null, persisted: null };
  }
}

export const fmtBytes = (n: number | null) => {
  if (n === null) return '—';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};
