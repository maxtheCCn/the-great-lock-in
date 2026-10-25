import Dexie, { type EntityTable } from 'dexie';
import type {
  ChatThread,
  CheckIn,
  CoachMemory,
  CoachReport,
  JournalEntry,
  LockIn,
  Measurement,
  MilestoneRecord,
  MiniGoal,
  PhotoBlob,
  PhotoComparison,
  ProgressPhoto,
  SuggestedWorkout,
  Workout,
} from './types';

export interface SettingRow {
  key: string;
  value: unknown;
}

export type TGLIDatabase = Dexie & {
  lockIns: EntityTable<LockIn, 'id'>;
  checkIns: EntityTable<CheckIn, 'id'>;
  workouts: EntityTable<Workout, 'id'>;
  measurements: EntityTable<Measurement, 'id'>;
  photos: EntityTable<ProgressPhoto, 'id'>;
  photoBlobs: EntityTable<PhotoBlob, 'id'>;
  comparisons: EntityTable<PhotoComparison, 'id'>;
  milestones: EntityTable<MilestoneRecord, 'id'>;
  goals: EntityTable<MiniGoal, 'id'>;
  journal: EntityTable<JournalEntry, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
  chats: EntityTable<ChatThread, 'id'>;
  memories: EntityTable<CoachMemory, 'id'>;
  suggestions: EntityTable<SuggestedWorkout, 'id'>;
  coachReports: EntityTable<CoachReport, 'id'>;
};

/**
 * Demo mode uses a completely separate database, so sample data can never
 * mix with — or overwrite — the user's real records.
 */
const MODE_KEY = 'tgli.mode';
export type DataMode = 'real' | 'demo';

export function getDataMode(): DataMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'real';
  } catch {
    return 'real';
  }
}

export function setDataMode(mode: DataMode) {
  try {
    if (mode === 'demo') localStorage.setItem(MODE_KEY, 'demo');
    else localStorage.removeItem(MODE_KEY);
  } catch {
    /* storage blocked — mode falls back to real */
  }
}

export const DB_NAMES: Record<DataMode, string> = { real: 'tgli', demo: 'tgli-demo' };

function createDb(name: string): TGLIDatabase {
  const d = new Dexie(name) as TGLIDatabase;
  d.version(1).stores({
    lockIns: 'id, status, createdAt',
    checkIns: 'id, lockInId, date, &[lockInId+date]',
    workouts: 'id, lockInId, date, [lockInId+date]',
    measurements: 'id, lockInId, date, kind',
    photos: 'id, lockInId, date, angle',
    photoBlobs: 'id',
    comparisons: 'id, lockInId',
    milestones: 'id, lockInId, &[lockInId+key]',
    goals: 'id, lockInId, status',
    journal: 'id, lockInId, date',
    settings: 'key',
    chats: 'id, updatedAt',
    memories: 'id, updatedAt',
    suggestions: 'id, status, createdAt',
    coachReports: 'id, weekStart, createdAt',
  });
  return d;
}

export const dataMode = getDataMode();
export const db = createDb(DB_NAMES[dataMode]);

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
