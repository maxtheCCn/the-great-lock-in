import type { MuscleId } from '../types';

export interface MuscleMeta {
  id: MuscleId;
  label: string;
  region: 'upper' | 'core' | 'lower';
  side: 'front' | 'back' | 'both';
  group: 'push' | 'pull' | 'legs' | 'core';
}

export const MUSCLES: MuscleMeta[] = [
  { id: 'chest', label: 'Chest', region: 'upper', side: 'front', group: 'push' },
  { id: 'shoulders', label: 'Shoulders', region: 'upper', side: 'both', group: 'push' },
  { id: 'biceps', label: 'Biceps', region: 'upper', side: 'front', group: 'pull' },
  { id: 'triceps', label: 'Triceps', region: 'upper', side: 'back', group: 'push' },
  { id: 'forearms', label: 'Forearms', region: 'upper', side: 'both', group: 'pull' },
  { id: 'traps', label: 'Traps', region: 'upper', side: 'back', group: 'pull' },
  { id: 'lats', label: 'Lats & upper back', region: 'upper', side: 'back', group: 'pull' },
  { id: 'abs', label: 'Abs', region: 'core', side: 'front', group: 'core' },
  { id: 'obliques', label: 'Obliques', region: 'core', side: 'front', group: 'core' },
  { id: 'lowerBack', label: 'Lower back', region: 'core', side: 'back', group: 'core' },
  { id: 'glutes', label: 'Glutes', region: 'lower', side: 'back', group: 'legs' },
  { id: 'quads', label: 'Quads', region: 'lower', side: 'front', group: 'legs' },
  { id: 'hamstrings', label: 'Hamstrings', region: 'lower', side: 'back', group: 'legs' },
  { id: 'calves', label: 'Calves', region: 'lower', side: 'back', group: 'legs' },
];

export const MUSCLE_IDS = MUSCLES.map((m) => m.id);
export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m])) as Record<MuscleId, MuscleMeta>;

/** Secondary muscles count as half a set — a common, transparent convention. */
export const SECONDARY_WEIGHT = 0.5;
