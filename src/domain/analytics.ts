/**
 * Deterministic analytics. No AI, no estimation:
 * missing values stay missing (null) and are never treated as zero.
 */
import type { CheckIn, DayRating, FoodLevel, HabitDef, ISODate, LockIn, MuscleId } from '@/data/types';
import type { TrainingRecord } from '@/data/training/source';
import { MUSCLE_IDS, SECONDARY_WEIGHT } from '@/data/training/muscles';
import { addDays, diffDays, eachDay, minDate, startOfWeek, todayISO } from './dates';

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

export const inDateRange = (d: ISODate, r: DateRange) => d >= r.start && d <= r.end;
export const filterRange = <T extends { date: ISODate }>(items: T[], r: DateRange) => items.filter((i) => inDateRange(i.date, r));

export const round = (v: number, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/* ── Periods ─────────────────────────────────────────────── */

export type Period = 'thisWeek' | 'lastWeek' | 'last30' | 'lockIn';

export const PERIOD_LABELS: Record<Period, string> = {
  thisWeek: 'This week',
  lastWeek: 'Last week',
  last30: 'Last 30 days',
  lockIn: 'Entire Lock In',
};

export function periodRange(p: Period, lockIn: Pick<LockIn, 'startDate' | 'targetDate'>, today: ISODate = todayISO()): DateRange {
  switch (p) {
    case 'thisWeek':
      return { start: startOfWeek(today), end: today };
    case 'lastWeek': {
      const s = addDays(startOfWeek(today), -7);
      return { start: s, end: addDays(s, 6) };
    }
    case 'last30':
      return { start: addDays(today, -29), end: today };
    case 'lockIn':
      return { start: lockIn.startDate, end: minDate(today, lockIn.targetDate) };
  }
}

/** The range of equal length immediately before `r`, or null for the whole Lock In. */
export function previousRange(p: Period, r: DateRange): DateRange | null {
  if (p === 'lockIn') return null;
  if (p === 'thisWeek') {
    // Compare like with like: the same weekdays of last week.
    return { start: addDays(r.start, -7), end: addDays(r.end, -7) };
  }
  const len = diffDays(r.start, r.end) + 1;
  return { start: addDays(r.start, -len), end: addDays(r.start, -1) };
}

/* ── Sleep ───────────────────────────────────────────────── */

export interface SleepStats {
  nights: number;
  total: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  /** Standard deviation in hours — night-to-night variability. */
  stdDev: number | null;
}

export function sleepStats(checkIns: CheckIn[], r?: DateRange): SleepStats {
  const vals = (r ? filterRange(checkIns, r) : checkIns)
    .map((c) => c.sleepHours)
    .filter((v): v is number => typeof v === 'number');
  if (!vals.length) return { nights: 0, total: 0, avg: null, min: null, max: null, stdDev: null };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, v) => a + (v - avg) ** 2, 0) / vals.length;
  return {
    nights: vals.length,
    total: vals.reduce((a, b) => a + b, 0),
    avg,
    min: Math.min(...vals),
    max: Math.max(...vals),
    stdDev: vals.length > 1 ? Math.sqrt(variance) : null,
  };
}

export interface SeriesPoint {
  date: ISODate;
  value: number | null;
}

/** One point per calendar day; days without a recorded value are null (gaps, not zeros). */
export function sleepSeries(checkIns: CheckIn[], r: DateRange): SeriesPoint[] {
  const byDate = new Map(checkIns.map((c) => [c.date, c.sleepHours]));
  return eachDay(r.start, r.end).map((date) => ({ date, value: byDate.get(date) ?? null }));
}

/** Trailing average over `window` days, only where at least `minValues` nights were recorded. */
export function rollingAverage(series: SeriesPoint[], window = 7, minValues = 3): SeriesPoint[] {
  return series.map((p, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1).map((s) => s.value).filter((v): v is number => v !== null);
    return { date: p.date, value: slice.length >= minValues ? mean(slice) : null };
  });
}

export interface BucketAverage {
  key: ISODate | string;
  avg: number | null;
  count: number;
}

export function weeklyAverages(checkIns: CheckIn[], r: DateRange): BucketAverage[] {
  const out: BucketAverage[] = [];
  for (let w = startOfWeek(r.start); w <= r.end; w = addDays(w, 7)) {
    const range = { start: w > r.start ? w : r.start, end: minDate(addDays(w, 6), r.end) };
    const s = sleepStats(checkIns, range);
    out.push({ key: w, avg: s.avg, count: s.nights });
  }
  return out;
}

export function monthlyAverages(checkIns: CheckIn[], r: DateRange): BucketAverage[] {
  const months = new Map<string, number[]>();
  for (const d of eachDay(r.start, r.end)) months.set(d.slice(0, 7), []);
  for (const c of filterRange(checkIns, r)) if (c.sleepHours !== null) months.get(c.date.slice(0, 7))?.push(c.sleepHours);
  return [...months.entries()].map(([key, vals]) => ({ key, avg: mean(vals), count: vals.length }));
}

/* ── Training ────────────────────────────────────────────── */

export interface TrainingSummary {
  /** Logged workouts + days marked "workout" in a check-in that have no detailed log. */
  sessions: number;
  logged: number;
  checkinOnly: number;
  restDays: number;
  missed: number;
  trainingDays: ISODate[];
}

export function trainingSummary(checkIns: CheckIn[], workouts: TrainingRecord[], r: DateRange): TrainingSummary {
  const ws = filterRange(workouts, r);
  const cs = filterRange(checkIns, r);
  const loggedDates = new Set(ws.map((w) => w.date));
  const checkinOnly = cs.filter((c) => c.training === 'workout' && !loggedDates.has(c.date));
  const days = new Set([...loggedDates, ...checkinOnly.map((c) => c.date)]);
  return {
    sessions: ws.length + checkinOnly.length,
    logged: ws.length,
    checkinOnly: checkinOnly.length,
    restDays: cs.filter((c) => c.training === 'rest').length,
    missed: cs.filter((c) => c.training === 'missed').length,
    trainingDays: [...days].sort(),
  };
}

export interface MuscleStat {
  id: MuscleId;
  /** Weighted sets: primary = 1, secondary = 0.5. */
  sets: number;
  directSets: number;
  days: number;
  lastDate: ISODate | null;
  exercises: { name: string; sets: number }[];
}

export function muscleVolume(workouts: TrainingRecord[], r: DateRange | null): Record<MuscleId, MuscleStat> {
  const out = Object.fromEntries(
    MUSCLE_IDS.map((id) => [id, { id, sets: 0, directSets: 0, days: 0, lastDate: null, exercises: [] } as MuscleStat]),
  ) as Record<MuscleId, MuscleStat>;
  const dayMap = new Map<MuscleId, Set<ISODate>>();
  const exMap = new Map<MuscleId, Map<string, number>>();
  const ws = r ? filterRange(workouts, r) : workouts;

  for (const w of ws) {
    for (const e of w.exercises) {
      const touch = (m: MuscleId, weight: number) => {
        const s = out[m];
        if (!s) return;
        s.sets += e.sets * weight;
        if (weight === 1) s.directSets += e.sets;
        if (!dayMap.has(m)) dayMap.set(m, new Set());
        dayMap.get(m)!.add(w.date);
        if (!s.lastDate || w.date > s.lastDate) s.lastDate = w.date;
        if (!exMap.has(m)) exMap.set(m, new Map());
        const em = exMap.get(m)!;
        em.set(e.name, (em.get(e.name) ?? 0) + e.sets * weight);
      };
      e.primary.forEach((m) => touch(m, 1));
      e.secondary.filter((m) => !e.primary.includes(m)).forEach((m) => touch(m, SECONDARY_WEIGHT));
    }
  }
  for (const id of MUSCLE_IDS) {
    out[id].days = dayMap.get(id)?.size ?? 0;
    out[id].exercises = [...(exMap.get(id)?.entries() ?? [])]
      .map(([name, sets]) => ({ name, sets }))
      .sort((a, b) => b.sets - a.sets);
  }
  return out;
}

export function totalSets(workouts: TrainingRecord[], r: DateRange | null): number {
  const ws = r ? filterRange(workouts, r) : workouts;
  return ws.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets, 0), 0);
}

export function weeklyVolume(workouts: TrainingRecord[], checkIns: CheckIn[], r: DateRange) {
  const out: { key: ISODate; sets: number; sessions: number }[] = [];
  for (let w = startOfWeek(r.start); w <= r.end; w = addDays(w, 7)) {
    const range = { start: w, end: addDays(w, 6) };
    out.push({ key: w, sets: totalSets(workouts, range), sessions: trainingSummary(checkIns, workouts, range).sessions });
  }
  return out;
}

/* ── Ratings, habits, food ───────────────────────────────── */

export type RatingBucket = DayRating | 'unrated';

export function ratingDistribution(checkIns: CheckIn[], days: ISODate[]): Record<RatingBucket, number> {
  const byDate = new Map(checkIns.map((c) => [c.date, c.rating]));
  const out: Record<RatingBucket, number> = { great: 0, good: 0, okay: 0, tough: 0, unrated: 0 };
  for (const d of days) out[byDate.get(d) ?? 'unrated']++;
  return out;
}

export interface HabitStat {
  habit: HabitDef;
  done: number;
  /** Check-ins in range (the denominator). */
  recorded: number;
  rate: number | null;
}

export function habitStats(checkIns: CheckIn[], habits: HabitDef[], r: DateRange): HabitStat[] {
  const cs = filterRange(checkIns, r);
  return habits.map((habit) => {
    const done = cs.filter((c) => c.habits?.[habit.id]).length;
    return { habit, done, recorded: cs.length, rate: cs.length ? done / cs.length : null };
  });
}

export function foodDistribution(checkIns: CheckIn[], r: DateRange) {
  const out: Record<FoodLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let recorded = 0;
  for (const c of filterRange(checkIns, r)) {
    if (c.food) {
      out[c.food]++;
      recorded++;
    }
  }
  return { counts: out, recorded };
}

/** Days of a range that fall inside the Lock In and are not in the future. */
export function eligibleDays(r: DateRange, lockIn: Pick<LockIn, 'startDate' | 'targetDate'>, today: ISODate = todayISO()): ISODate[] {
  const start = r.start > lockIn.startDate ? r.start : lockIn.startDate;
  const end = minDate(minDate(r.end, lockIn.targetDate), today);
  return eachDay(start, end);
}

export function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}
