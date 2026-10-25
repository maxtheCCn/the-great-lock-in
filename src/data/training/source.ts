import { db } from '../db';
import type { ISODate, MuscleId, Workout } from '../types';

/**
 * Normalised training record consumed by every analytics module
 * (muscle map, training balance, workout stats, weekly review, coach context).
 *
 * Today the only source is TGLI's own local workout log. A future NW Log
 * adapter would implement `WorkoutSource` and map its records into this shape —
 * nothing else in the app needs to change. No integration exists yet.
 */
export interface TrainingRecord {
  id: string;
  date: ISODate;
  title: string;
  durationMin: number | null;
  source: Workout['source'];
  exercises: {
    name: string;
    primary: MuscleId[];
    secondary: MuscleId[];
    sets: number;
    reps: number | null;
    weight: number | null;
  }[];
}

export interface WorkoutSource {
  id: string;
  label: string;
  list(lockInId: string): Promise<TrainingRecord[]>;
}

export const toTrainingRecord = (w: Workout): TrainingRecord => ({
  id: w.id,
  date: w.date,
  title: w.title,
  durationMin: w.durationMin,
  source: w.source,
  exercises: w.exercises.map((e) => ({
    name: e.name,
    primary: e.primary,
    secondary: e.secondary,
    sets: e.sets,
    reps: e.reps,
    weight: e.weight,
  })),
});

export const localWorkoutSource: WorkoutSource = {
  id: 'local',
  label: 'TGLI workout log',
  async list(lockInId) {
    const rows = await db.workouts.where('lockInId').equals(lockInId).sortBy('date');
    return rows.map(toTrainingRecord);
  },
};
