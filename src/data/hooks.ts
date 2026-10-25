import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from './db';
import { toTrainingRecord, type TrainingRecord } from './training/source';
import type { CheckIn, JournalEntry, LockIn, Measurement, MilestoneRecord, MiniGoal, ProgressPhoto, Workout } from './types';

const EMPTY: never[] = [];

/** `undefined` while loading, `null` when there is no active Lock In. */
export function useActiveLockIn(): LockIn | null | undefined {
  return useLiveQuery(async () => (await db.lockIns.where('status').equals('active').first()) ?? null, []);
}

export function useLockIn(id: string | undefined): LockIn | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.lockIns.get(id)) ?? null) : null), [id]);
}

export function useArchivedLockIns(): LockIn[] | undefined {
  return useLiveQuery(() => db.lockIns.where('status').equals('completed').reverse().sortBy('completedAt'), []);
}

export function useCheckIns(lockInId: string | undefined): CheckIn[] {
  return useLiveQuery(() => (lockInId ? db.checkIns.where('lockInId').equals(lockInId).sortBy('date') : EMPTY), [lockInId]) ?? EMPTY;
}

export function useWorkoutRows(lockInId: string | undefined): Workout[] {
  return useLiveQuery(() => (lockInId ? db.workouts.where('lockInId').equals(lockInId).sortBy('date') : EMPTY), [lockInId]) ?? EMPTY;
}

/** Normalised training records (see `training/source.ts`). */
export function useTraining(lockInId: string | undefined): TrainingRecord[] {
  const rows = useWorkoutRows(lockInId);
  return useMemo(() => rows.map(toTrainingRecord), [rows]);
}

export function useMeasurements(lockInId: string | undefined): Measurement[] {
  return useLiveQuery(() => (lockInId ? db.measurements.where('lockInId').equals(lockInId).sortBy('date') : EMPTY), [lockInId]) ?? EMPTY;
}

export function usePhotos(lockInId: string | undefined): ProgressPhoto[] | undefined {
  return useLiveQuery(() => (lockInId ? db.photos.where('lockInId').equals(lockInId).sortBy('date') : EMPTY), [lockInId]);
}

export function useMilestoneRecords(lockInId: string | undefined): MilestoneRecord[] {
  return useLiveQuery(() => (lockInId ? db.milestones.where('lockInId').equals(lockInId).sortBy('achievedAt') : EMPTY), [lockInId]) ?? EMPTY;
}

export function useGoals(lockInId: string | undefined): MiniGoal[] {
  return useLiveQuery(() => (lockInId ? db.goals.where('lockInId').equals(lockInId).sortBy('createdAt') : EMPTY), [lockInId]) ?? EMPTY;
}

export function useJournal(lockInId: string | undefined): JournalEntry[] {
  return useLiveQuery(() => (lockInId ? db.journal.where('lockInId').equals(lockInId).reverse().sortBy('date') : EMPTY), [lockInId]) ?? EMPTY;
}
