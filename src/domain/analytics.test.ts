import { describe, expect, it } from 'vitest';
import type { CheckIn, LockIn } from '@/data/types';
import type { TrainingRecord } from '@/data/training/source';
import { addDays, diffDays, eachDay, isoWeekNumber, startOfWeek } from './dates';
import { lockInTimeline } from './timeline';
import { muscleVolume, ratingDistribution, rollingAverage, sleepSeries, sleepStats, trainingSummary } from './analytics';
import { buildWeeklyReview } from './weekly';
import { goalProgress } from './goals';

const ci = (date: string, p: Partial<CheckIn> = {}): CheckIn => ({
  id: date,
  lockInId: 'L',
  date,
  sleepHours: null,
  training: null,
  food: null,
  creatine: null,
  protein: null,
  habits: {},
  rating: null,
  note: '',
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

const lockIn: LockIn = {
  id: 'L',
  name: 'Test',
  startDate: '2026-10-05',
  targetDate: '2026-11-03',
  motivation: '',
  goals: ['strength'],
  experience: 'some',
  weeklyFrequency: 3,
  preferences: [],
  habits: [{ id: 'water', label: 'Water', icon: 'water' }],
  status: 'active',
  createdAt: 0,
  updatedAt: 0,
};

describe('dates', () => {
  it('handles DST boundaries without off-by-one', () => {
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2); // EU DST ends 25 Oct
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });
  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19'); // Sunday → Monday
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
  });
  it('computes ISO week numbers', () => {
    expect(isoWeekNumber('2026-01-01')).toBe(1);
    expect(isoWeekNumber('2026-10-25')).toBe(43);
  });
});

describe('timeline', () => {
  it('counts days inclusively and remaining days after today', () => {
    const t = lockInTimeline({ startDate: '2026-10-01', targetDate: '2026-10-10' }, new Date(2026, 9, 3, 12));
    expect(t.totalDays).toBe(10);
    expect(t.dayNumber).toBe(3);
    expect(t.daysCompleted).toBe(2);
    expect(t.daysRemaining).toBe(7);
    expect(t.phase).toBe('active');
  });
  it('reports upcoming and ended phases', () => {
    expect(lockInTimeline({ startDate: '2026-10-10', targetDate: '2026-10-20' }, new Date(2026, 9, 5)).phase).toBe('upcoming');
    expect(lockInTimeline({ startDate: '2026-10-01', targetDate: '2026-10-05' }, new Date(2026, 9, 6, 1)).phase).toBe('ended');
  });
});

describe('sleep', () => {
  const data = [ci('2026-10-05', { sleepHours: 7 }), ci('2026-10-06'), ci('2026-10-07', { sleepHours: 9 })];
  it('never treats missing nights as zero', () => {
    const s = sleepStats(data);
    expect(s.nights).toBe(2);
    expect(s.avg).toBe(8);
    expect(s.min).toBe(7);
  });
  it('keeps gaps in the series and requires enough nights for rolling averages', () => {
    const series = sleepSeries(data, { start: '2026-10-05', end: '2026-10-08' });
    expect(series.map((p) => p.value)).toEqual([7, null, 9, null]);
    expect(rollingAverage(series, 7, 3).every((p) => p.value === null)).toBe(true);
  });
  it('returns nulls with no data', () => {
    expect(sleepStats([]).avg).toBeNull();
  });
});

describe('training', () => {
  const workouts: TrainingRecord[] = [
    { id: 'w1', date: '2026-10-05', title: 'Push', durationMin: 60, source: 'manual', exercises: [{ name: 'Bench', primary: ['chest'], secondary: ['triceps', 'shoulders'], sets: 4, reps: 8, weight: null }] },
  ];
  const checkIns = [ci('2026-10-05', { training: 'workout' }), ci('2026-10-06', { training: 'workout' }), ci('2026-10-07', { training: 'rest' }), ci('2026-10-08', { training: 'missed' })];
  it('does not double count a check-in workout that also has a log', () => {
    const t = trainingSummary(checkIns, workouts, { start: '2026-10-01', end: '2026-10-31' });
    expect(t.sessions).toBe(2);
    expect(t.logged).toBe(1);
    expect(t.checkinOnly).toBe(1);
    expect(t.restDays).toBe(1);
    expect(t.missed).toBe(1);
  });
  it('weights secondary muscles at half a set', () => {
    const v = muscleVolume(workouts, null);
    expect(v.chest.sets).toBe(4);
    expect(v.triceps.sets).toBe(2);
    expect(v.chest.days).toBe(1);
    expect(v.quads.sets).toBe(0);
  });
});

describe('ratings', () => {
  it('counts unrated days separately', () => {
    const d = ratingDistribution([ci('2026-10-05', { rating: 'great' }), ci('2026-10-06')], eachDay('2026-10-05', '2026-10-07'));
    expect(d).toEqual({ great: 1, good: 0, okay: 0, tough: 0, unrated: 2 });
  });
});

describe('weekly review', () => {
  it('distinguishes missing sleep from zero and limits days to the Lock In', () => {
    const r = buildWeeklyReview(
      { lockIn, checkIns: [ci('2026-10-05', { training: 'workout' })], workouts: [], milestones: [], measurements: [], journal: [], photos: [] },
      '2026-10-05',
      '2026-10-20',
    );
    expect(r.days.length).toBe(7);
    expect(r.checkIns).toBe(1);
    expect(r.sleep.avg).toBeNull();
    expect(r.training.sessions).toBe(1);
    expect(r.previous).toBeNull(); // week before the Lock In
    expect(r.complete).toBe(true);
  });
});

describe('mini goals', () => {
  it('measures habit goals from check-ins in the period', () => {
    const p = goalProgress(
      { id: 'g', lockInId: 'L', title: 'Water', metric: 'habit', target: 2, manualProgress: 0, sleepThreshold: null, habitId: 'water', startDate: '2026-10-05', endDate: '2026-10-11', status: 'active', createdAt: 0, updatedAt: 0 },
      [ci('2026-10-05', { habits: { water: true } }), ci('2026-10-06', { habits: { water: true } }), ci('2026-10-20', { habits: { water: true } })],
      [],
    );
    expect(p.current).toBe(2);
    expect(p.reached).toBe(true);
  });
});
