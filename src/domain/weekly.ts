/**
 * Deterministic weekly review. Works with no AI provider configured.
 * Every figure is computed from recorded data; "no data" is reported as null.
 */
import type { CheckIn, ISODate, JournalEntry, LockIn, Measurement, MilestoneRecord, MuscleId, ProgressPhoto } from '@/data/types';
import type { TrainingRecord } from '@/data/training/source';
import { MUSCLE_IDS } from '@/data/training/muscles';
import { addDays, minDate, parseISO, startOfWeek, todayISO } from './dates';
import {
  eligibleDays,
  filterRange,
  foodDistribution,
  habitStats,
  muscleVolume,
  ratingDistribution,
  sleepStats,
  totalSets,
  trainingSummary,
  type HabitStat,
  type RatingBucket,
  type SleepStats,
  type TrainingSummary,
} from './analytics';

export interface WeeklyInput {
  lockIn: LockIn;
  checkIns: CheckIn[];
  workouts: TrainingRecord[];
  milestones: MilestoneRecord[];
  measurements: Pick<Measurement, 'date' | 'kind' | 'valueCm'>[];
  journal: Pick<JournalEntry, 'date'>[];
  photos: Pick<ProgressPhoto, 'date'>[];
}

export interface WeekSnapshot {
  checkIns: number;
  eligibleDays: number;
  sessions: number;
  sleepAvg: number | null;
  sets: number;
}

export interface WeeklyReview {
  weekStart: ISODate;
  weekEnd: ISODate;
  /** True once the whole week is in the past. */
  complete: boolean;
  days: ISODate[];
  checkIns: number;
  training: TrainingSummary;
  sleep: SleepStats;
  ratings: Record<RatingBucket, number>;
  habits: HabitStat[];
  food: { counts: Record<1 | 2 | 3 | 4, number>; recorded: number };
  muscles: { id: MuscleId; sets: number }[];
  sets: number;
  milestones: MilestoneRecord[];
  measurements: number;
  journal: number;
  photos: number;
  /** Previous week, or null when it falls before the Lock In started. */
  previous: WeekSnapshot | null;
}

function snapshot(input: WeeklyInput, weekStart: ISODate, today: ISODate): WeekSnapshot | null {
  const r = { start: weekStart, end: addDays(weekStart, 6) };
  const days = eligibleDays(r, input.lockIn, today);
  if (!days.length) return null;
  const range = { start: days[0], end: days[days.length - 1] };
  return {
    checkIns: filterRange(input.checkIns, range).length,
    eligibleDays: days.length,
    sessions: trainingSummary(input.checkIns, input.workouts, range).sessions,
    sleepAvg: sleepStats(input.checkIns, range).avg,
    sets: totalSets(input.workouts, range),
  };
}

export function buildWeeklyReview(input: WeeklyInput, weekStart: ISODate, today: ISODate = todayISO()): WeeklyReview {
  const weekEnd = addDays(weekStart, 6);
  const days = eligibleDays({ start: weekStart, end: weekEnd }, input.lockIn, today);
  const range = days.length ? { start: days[0], end: days[days.length - 1] } : { start: weekStart, end: weekStart };
  const empty = !days.length;

  const vol = muscleVolume(input.workouts, range);
  const startMs = parseISO(weekStart).getTime();
  const endMs = parseISO(addDays(weekEnd, 1)).getTime();

  return {
    weekStart,
    weekEnd,
    complete: weekEnd < today,
    days,
    checkIns: empty ? 0 : filterRange(input.checkIns, range).length,
    training: trainingSummary(empty ? [] : input.checkIns, empty ? [] : input.workouts, range),
    sleep: sleepStats(empty ? [] : input.checkIns, range),
    ratings: ratingDistribution(input.checkIns, days),
    habits: habitStats(empty ? [] : input.checkIns, input.lockIn.habits, range),
    food: foodDistribution(empty ? [] : input.checkIns, range),
    muscles: MUSCLE_IDS.map((id) => ({ id, sets: vol[id].sets }))
      .filter((m) => m.sets > 0)
      .sort((a, b) => b.sets - a.sets),
    sets: empty ? 0 : totalSets(input.workouts, range),
    milestones: input.milestones.filter((m) => m.achievedAt >= startMs && m.achievedAt < endMs),
    measurements: filterRange(input.measurements, range).length,
    journal: filterRange(input.journal, range).length,
    photos: filterRange(input.photos, range).length,
    previous: snapshot(input, addDays(weekStart, -7), today),
  };
}

/** Week starts (Mondays) that overlap the Lock In up to today, newest first. */
export function lockInWeeks(lockIn: Pick<LockIn, 'startDate' | 'targetDate'>, today: ISODate = todayISO()): ISODate[] {
  const last = startOfWeek(minDate(today, lockIn.targetDate));
  const out: ISODate[] = [];
  for (let w = startOfWeek(lockIn.startDate); w <= last; w = addDays(w, 7)) out.push(w);
  return out.reverse();
}
