import type { MuscleId } from '@/data/types';
import type { MuscleStat } from '@/domain/analytics';

export type Level = 0 | 1 | 2 | 3;

/** Relative buckets: brightness compares groups within the selected period only. */
export function levelFor(sets: number, max: number): Level {
  if (sets <= 0 || max <= 0) return 0;
  const t = sets / max;
  if (t > 0.66) return 3;
  if (t > 0.33) return 2;
  return 1;
}

export const LEVEL_COLORS: Record<Level, string> = {
  0: '#1b2520',
  1: '#1f6a3f',
  2: '#2fbf68',
  3: '#a6f7bd',
};

export const LEVEL_EMISSIVE: Record<Level, number> = { 0: 0, 1: 0.35, 2: 0.7, 3: 1.1 };

export const LEVEL_LABELS: Record<Level, string> = {
  0: 'No recorded training',
  1: 'Some',
  2: 'Moderate',
  3: 'Relatively high',
};

export function maxSets(volume: Record<MuscleId, MuscleStat>): number {
  return Math.max(0, ...Object.values(volume).map((v) => v.sets));
}
