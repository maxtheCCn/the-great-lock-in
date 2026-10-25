import type { DayRating, FoodLevel, TrainingStatus } from '@/data/types';

export const RATINGS: { value: DayRating; label: string; color: string; hint: string }[] = [
  { value: 'great', label: 'Great', color: '#1fc464', hint: 'Dark green' },
  { value: 'good', label: 'Good', color: '#a8f5c0', hint: 'Light green' },
  { value: 'okay', label: 'Okay', color: '#f2cc5c', hint: 'Yellow' },
  { value: 'tough', label: 'Tough', color: '#f0705f', hint: 'Red' },
];

export const RATING_COLOR: Record<DayRating, string> = Object.fromEntries(RATINGS.map((r) => [r.value, r.color])) as Record<DayRating, string>;
export const RATING_LABEL: Record<DayRating, string> = Object.fromEntries(RATINGS.map((r) => [r.value, r.label])) as Record<DayRating, string>;
export const UNRATED_COLOR = '#25302a';

export const TRAINING_LABEL: Record<TrainingStatus, string> = {
  workout: 'Completed workout',
  rest: 'Planned rest day',
  missed: 'Missed planned workout',
};

export const TRAINING_SHORT: Record<TrainingStatus, string> = {
  workout: 'Workout',
  rest: 'Rest day',
  missed: 'Missed',
};

/** Neutral, non-judgmental wording. */
export const FOOD_LEVELS: { value: FoodLevel; label: string; desc: string }[] = [
  { value: 1, label: 'Light focus', desc: 'Food wasn’t a priority today' },
  { value: 2, label: 'Some balance', desc: 'A few balanced meals' },
  { value: 3, label: 'Mostly balanced', desc: 'Regular, varied meals' },
  { value: 4, label: 'Well fuelled', desc: 'Ate in a way that supports my goals' },
];

export const FOOD_LABEL: Record<FoodLevel, string> = Object.fromEntries(FOOD_LEVELS.map((f) => [f.value, f.label])) as Record<FoodLevel, string>;

export const fmtHours = (h: number | null | undefined, dp = 1) => (h === null || h === undefined ? '—' : `${Number(h.toFixed(dp))}h`);
