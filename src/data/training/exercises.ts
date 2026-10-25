import type { MuscleId } from '../types';

export interface ExerciseDef {
  id: string;
  name: string;
  primary: MuscleId[];
  secondary: MuscleId[];
  category: 'push' | 'pull' | 'legs' | 'core' | 'arms';
}

const ex = (
  id: string,
  name: string,
  category: ExerciseDef['category'],
  primary: MuscleId[],
  secondary: MuscleId[] = [],
): ExerciseDef => ({ id, name, category, primary, secondary });

/** Starter library mapping common exercises to the muscle groups they mainly train. */
export const EXERCISES: ExerciseDef[] = [
  ex('bench-press', 'Bench press', 'push', ['chest'], ['triceps', 'shoulders']),
  ex('incline-db-press', 'Incline dumbbell press', 'push', ['chest'], ['shoulders', 'triceps']),
  ex('push-up', 'Push-up', 'push', ['chest'], ['triceps', 'shoulders', 'abs']),
  ex('chest-fly', 'Chest fly', 'push', ['chest'], ['shoulders']),
  ex('dip', 'Dip', 'push', ['triceps', 'chest'], ['shoulders']),
  ex('overhead-press', 'Overhead press', 'push', ['shoulders'], ['triceps', 'traps']),
  ex('lateral-raise', 'Lateral raise', 'push', ['shoulders']),
  ex('rear-delt-fly', 'Rear delt fly', 'pull', ['shoulders'], ['traps']),
  ex('face-pull', 'Face pull', 'pull', ['shoulders'], ['traps']),
  ex('pull-up', 'Pull-up / chin-up', 'pull', ['lats'], ['biceps', 'forearms']),
  ex('lat-pulldown', 'Lat pulldown', 'pull', ['lats'], ['biceps']),
  ex('barbell-row', 'Barbell row', 'pull', ['lats'], ['traps', 'biceps', 'lowerBack']),
  ex('cable-row', 'Seated cable row', 'pull', ['lats'], ['traps', 'biceps']),
  ex('db-row', 'One-arm dumbbell row', 'pull', ['lats'], ['biceps', 'traps']),
  ex('shrug', 'Shrug', 'pull', ['traps'], ['forearms']),
  ex('deadlift', 'Deadlift', 'legs', ['hamstrings', 'glutes', 'lowerBack'], ['traps', 'forearms', 'quads']),
  ex('rdl', 'Romanian deadlift', 'legs', ['hamstrings'], ['glutes', 'lowerBack']),
  ex('squat', 'Back squat', 'legs', ['quads', 'glutes'], ['lowerBack', 'hamstrings']),
  ex('front-squat', 'Front squat', 'legs', ['quads'], ['glutes', 'abs']),
  ex('goblet-squat', 'Goblet squat', 'legs', ['quads', 'glutes'], ['abs']),
  ex('leg-press', 'Leg press', 'legs', ['quads'], ['glutes']),
  ex('lunge', 'Lunge', 'legs', ['quads', 'glutes'], ['hamstrings']),
  ex('split-squat', 'Bulgarian split squat', 'legs', ['quads', 'glutes'], ['hamstrings']),
  ex('leg-extension', 'Leg extension', 'legs', ['quads']),
  ex('leg-curl', 'Leg curl', 'legs', ['hamstrings']),
  ex('hip-thrust', 'Hip thrust', 'legs', ['glutes'], ['hamstrings']),
  ex('calf-raise', 'Calf raise', 'legs', ['calves']),
  ex('bicep-curl', 'Bicep curl', 'arms', ['biceps'], ['forearms']),
  ex('hammer-curl', 'Hammer curl', 'arms', ['biceps', 'forearms']),
  ex('tricep-pushdown', 'Triceps pushdown', 'arms', ['triceps']),
  ex('skull-crusher', 'Skull crusher', 'arms', ['triceps']),
  ex('overhead-extension', 'Overhead triceps extension', 'arms', ['triceps']),
  ex('wrist-curl', 'Wrist curl', 'arms', ['forearms']),
  ex('plank', 'Plank', 'core', ['abs'], ['obliques']),
  ex('crunch', 'Crunch', 'core', ['abs']),
  ex('cable-crunch', 'Cable crunch', 'core', ['abs']),
  ex('leg-raise', 'Hanging leg raise', 'core', ['abs'], ['obliques', 'forearms']),
  ex('russian-twist', 'Russian twist', 'core', ['obliques'], ['abs']),
  ex('woodchop', 'Cable woodchop', 'core', ['obliques'], ['abs', 'shoulders']),
  ex('back-extension', 'Back extension', 'core', ['lowerBack'], ['glutes', 'hamstrings']),
];

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e])) as Record<string, ExerciseDef>;
