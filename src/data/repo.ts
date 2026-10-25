import { db, uid } from './db';
import type {
  CheckIn,
  CoachMemory,
  ISODate,
  JournalEntry,
  LockIn,
  Measurement,
  MiniGoal,
  PhotoAngle,
  ProgressPhoto,
  SuggestedWorkout,
  Workout,
} from './types';
import { earnedMilestones } from '@/domain/milestones';
import { lockInTimeline } from '@/domain/timeline';
import { trainingSummary } from '@/domain/analytics';
import { goalProgress } from '@/domain/goals';
import { toTrainingRecord } from './training/source';
import { processImage, releaseImageUrl } from '@/services/images';
import { useUI } from '@/state/ui';

const now = () => Date.now();

/* ── Milestone engine ────────────────────────────────────── */

let milestoneRun: Promise<void> = Promise.resolve();

/** Evaluates milestones from recorded data and celebrates newly earned ones. Serialized to avoid duplicates. */
export function runMilestones(lockInId: string, opts: { celebrate?: boolean } = {}): Promise<void> {
  milestoneRun = milestoneRun.then(() => evaluate(lockInId, opts.celebrate ?? true)).catch((e) => console.error('milestones', e));
  return milestoneRun;
}

async function evaluate(lockInId: string, celebrate: boolean) {
  const lockIn = await db.lockIns.get(lockInId);
  if (!lockIn) return;
  const [checkIns, workouts, photos, measurements, journal, goals, existing, reviewRow] = await Promise.all([
    db.checkIns.where('lockInId').equals(lockInId).toArray(),
    db.workouts.where('lockInId').equals(lockInId).toArray(),
    db.photos.where('lockInId').equals(lockInId).count(),
    db.measurements.where('lockInId').equals(lockInId).count(),
    db.journal.where('lockInId').equals(lockInId).count(),
    db.goals.where('lockInId').equals(lockInId).toArray(),
    db.milestones.where('lockInId').equals(lockInId).toArray(),
    db.settings.get(`reviewViewed:${lockInId}`),
  ]);
  const range = { start: '0000-01-01', end: '9999-12-31' };
  const t = trainingSummary(checkIns, workouts.map(toTrainingRecord), range);
  const earned = earnedMilestones({
    checkIns: checkIns.length,
    sessions: t.sessions,
    restDays: t.restDays,
    goodSleepNights: checkIns.filter((c) => (c.sleepHours ?? 0) >= 7).length,
    photos,
    measurements,
    journal,
    goalsCompleted: goals.filter((g) => g.status === 'completed' || (g.status === 'archived' && g.completedAt)).length,
    reviewViewed: !!reviewRow,
    elapsed: lockInTimeline(lockIn).elapsed,
    completed: lockIn.status === 'completed',
  });
  const have = new Set(existing.map((m) => m.key));
  const fresh = earned.filter((k) => !have.has(k));
  if (!fresh.length) return;
  const at = now();
  await db.milestones.bulkPut(fresh.map((key) => ({ id: `${lockInId}:${key}`, lockInId, key, achievedAt: at, seen: !celebrate })));
  if (celebrate) useUI.getState().enqueueCelebrations(fresh);
}

export async function markMilestonesSeen(lockInId: string, keys: string[]) {
  await db.milestones.where('id').anyOf(keys.map((k) => `${lockInId}:${k}`)).modify({ seen: true });
}

/* ── Lock In ─────────────────────────────────────────────── */

export type NewLockIn = Omit<LockIn, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'completedAt'>;

export async function createLockIn(input: NewLockIn): Promise<LockIn> {
  return db.transaction('rw', db.lockIns, async () => {
    const active = await db.lockIns.where('status').equals('active').count();
    if (active) throw new Error('Only one Lock In can be active at a time. Complete the current one first.');
    const lockIn: LockIn = { ...input, id: uid(), status: 'active', createdAt: now(), updatedAt: now() };
    await db.lockIns.add(lockIn);
    return lockIn;
  });
}

export async function updateLockIn(id: string, patch: Partial<Omit<LockIn, 'id' | 'createdAt'>>) {
  await db.lockIns.update(id, { ...patch, updatedAt: now() });
  await runMilestones(id);
}

export async function completeLockIn(id: string) {
  await db.lockIns.update(id, { status: 'completed', completedAt: now(), updatedAt: now() });
  await runMilestones(id);
}

/* ── Check-ins ───────────────────────────────────────────── */

export type CheckInDraft = Omit<CheckIn, 'id' | 'lockInId' | 'date' | 'createdAt' | 'updatedAt'>;

export async function saveCheckIn(lockInId: string, date: ISODate, draft: CheckInDraft): Promise<CheckIn> {
  const saved = await db.transaction('rw', db.checkIns, async () => {
    const existing = await db.checkIns.where('[lockInId+date]').equals([lockInId, date]).first();
    const row: CheckIn = existing
      ? { ...existing, ...draft, updatedAt: now() }
      : { ...draft, id: uid(), lockInId, date, createdAt: now(), updatedAt: now() };
    await db.checkIns.put(row);
    return row;
  });
  await runMilestones(lockInId);
  return saved;
}

export async function deleteCheckIn(id: string) {
  await db.checkIns.delete(id);
}

/* ── Workouts ────────────────────────────────────────────── */

export type WorkoutDraft = Omit<Workout, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export async function saveWorkout(draft: WorkoutDraft): Promise<Workout> {
  const existing = draft.id ? await db.workouts.get(draft.id) : undefined;
  const row: Workout = existing
    ? { ...existing, ...draft, id: existing.id, updatedAt: now() }
    : { ...draft, id: uid(), createdAt: now(), updatedAt: now() };
  await db.workouts.put(row);
  await runMilestones(row.lockInId);
  return row;
}

export async function deleteWorkout(id: string) {
  await db.workouts.delete(id);
}

/* ── Measurements ────────────────────────────────────────── */

export type MeasurementDraft = Omit<Measurement, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export async function saveMeasurement(draft: MeasurementDraft): Promise<Measurement> {
  const existing = draft.id ? await db.measurements.get(draft.id) : undefined;
  const row: Measurement = existing
    ? { ...existing, ...draft, id: existing.id, updatedAt: now() }
    : { ...draft, id: uid(), createdAt: now(), updatedAt: now() };
  await db.measurements.put(row);
  await runMilestones(row.lockInId);
  return row;
}

export async function deleteMeasurement(id: string) {
  await db.measurements.delete(id);
}

/* ── Photos ──────────────────────────────────────────────── */

export async function addPhoto(lockInId: string, file: Blob, angle: PhotoAngle, date: ISODate, note = ''): Promise<ProgressPhoto> {
  const [full, thumb] = await Promise.all([processImage(file, 1600, 0.86), processImage(file, 420, 0.78)]);
  const id = uid();
  const photo: ProgressPhoto = {
    id,
    lockInId,
    date,
    angle,
    thumb: thumb.data,
    mime: full.mime,
    width: full.width,
    height: full.height,
    note,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.transaction('rw', db.photos, db.photoBlobs, async () => {
    await db.photos.add(photo);
    await db.photoBlobs.add({ id, data: full.data });
  });
  await runMilestones(lockInId);
  return photo;
}

export async function updatePhoto(id: string, patch: Partial<Pick<ProgressPhoto, 'date' | 'angle' | 'note'>>) {
  await db.photos.update(id, { ...patch, updatedAt: now() });
}

export async function deletePhoto(id: string) {
  await db.transaction('rw', db.photos, db.photoBlobs, db.comparisons, async () => {
    await db.photos.delete(id);
    await db.photoBlobs.delete(id);
    await db.comparisons.filter((c) => c.beforeId === id || c.afterId === id).delete();
  });
  releaseImageUrl(`thumb:${id}`);
  releaseImageUrl(`full:${id}`);
}

export async function saveComparisonNote(lockInId: string, beforeId: string, afterId: string, note: string) {
  const existing = await db.comparisons.filter((c) => c.beforeId === beforeId && c.afterId === afterId).first();
  if (existing) await db.comparisons.update(existing.id, { note, updatedAt: now() });
  else await db.comparisons.add({ id: uid(), lockInId, beforeId, afterId, note, createdAt: now(), updatedAt: now() });
}

/* ── Mini goals ──────────────────────────────────────────── */

export type GoalDraft = Omit<MiniGoal, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'completedAt'> & { id?: string };

export async function saveGoal(draft: GoalDraft): Promise<MiniGoal> {
  const existing = draft.id ? await db.goals.get(draft.id) : undefined;
  const row: MiniGoal = existing
    ? { ...existing, ...draft, id: existing.id, updatedAt: now() }
    : { ...draft, id: uid(), status: 'active', createdAt: now(), updatedAt: now() };
  await db.goals.put(row);
  return row;
}

export async function setGoalStatus(id: string, status: MiniGoal['status']) {
  const g = await db.goals.get(id);
  if (!g) return;
  await db.goals.update(id, {
    status,
    completedAt: status === 'completed' ? now() : status === 'active' ? undefined : g.completedAt,
    updatedAt: now(),
  });
  await runMilestones(g.lockInId);
}

export async function bumpManualGoal(id: string, by: number) {
  const g = await db.goals.get(id);
  if (!g) return;
  await db.goals.update(id, { manualProgress: Math.max(0, g.manualProgress + by), updatedAt: now() });
}

/** Auto-complete goals whose target has been reached by recorded data. */
export async function syncGoalCompletion(lockInId: string): Promise<MiniGoal[]> {
  const [goals, checkIns, workouts] = await Promise.all([
    db.goals.where('lockInId').equals(lockInId).filter((g) => g.status === 'active').toArray(),
    db.checkIns.where('lockInId').equals(lockInId).toArray(),
    db.workouts.where('lockInId').equals(lockInId).toArray(),
  ]);
  const records = workouts.map(toTrainingRecord);
  const done = goals.filter((g) => goalProgress(g, checkIns, records).reached);
  for (const g of done) await db.goals.update(g.id, { status: 'completed', completedAt: now(), updatedAt: now() });
  if (done.length) await runMilestones(lockInId);
  return done;
}

/* ── Journal ─────────────────────────────────────────────── */

export type JournalDraft = Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export async function saveJournal(draft: JournalDraft): Promise<JournalEntry> {
  const existing = draft.id ? await db.journal.get(draft.id) : undefined;
  const row: JournalEntry = existing
    ? { ...existing, ...draft, id: existing.id, updatedAt: now() }
    : { ...draft, id: uid(), createdAt: now(), updatedAt: now() };
  await db.journal.put(row);
  await runMilestones(row.lockInId);
  return row;
}

export async function deleteJournal(id: string) {
  await db.journal.delete(id);
}

/* ── Reviews ─────────────────────────────────────────────── */

export async function markReviewViewed(lockInId: string) {
  const key = `reviewViewed:${lockInId}`;
  if (await db.settings.get(key)) return;
  await db.settings.put({ key, value: now() });
  await runMilestones(lockInId);
}

/* ── Coach ───────────────────────────────────────────────── */

export async function saveMemory(text: string, category: CoachMemory['category'], source: CoachMemory['source'], id?: string) {
  const existing = id ? await db.memories.get(id) : undefined;
  const row: CoachMemory = existing
    ? { ...existing, text, category, updatedAt: now() }
    : { id: uid(), text, category, source, createdAt: now(), updatedAt: now() };
  await db.memories.put(row);
  return row;
}

export async function saveSuggestion(s: Omit<SuggestedWorkout, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const existing = s.id ? await db.suggestions.get(s.id) : undefined;
  const row: SuggestedWorkout = existing
    ? { ...existing, ...s, id: existing.id, updatedAt: now() }
    : { ...s, id: uid(), createdAt: now(), updatedAt: now() };
  await db.suggestions.put(row);
  return row;
}
