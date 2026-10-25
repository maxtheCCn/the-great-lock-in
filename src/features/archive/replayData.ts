import { db } from '@/data/db';
import { toTrainingRecord } from '@/data/training/source';
import type { DayRating, LockIn, MilestoneRecord } from '@/data/types';
import { addDays, eachDay, minDate, todayISO } from '@/domain/dates';
import { sleepStats, totalSets, trainingSummary } from '@/domain/analytics';
import { GOAL_META } from '@/components/icons';

export interface ReplayData {
  lockIn: LockIn;
  goals: string[];
  totalDays: number;
  elapsedDays: number;
  checkIns: number;
  /** One entry per Lock In day: the chosen rating, 'logged' (checked in, unrated) or null. */
  mosaic: (DayRating | 'logged' | null)[];
  sessions: number;
  sets: number;
  restDays: number;
  sleepAvg: number | null;
  sleepNights: number;
  firstWeekSleep: number | null;
  lastWeekSleep: number | null;
  milestones: MilestoneRecord[];
  photoCount: number;
  journalCount: number;
}

export async function loadReplayData(lockInId: string): Promise<ReplayData | null> {
  const lockIn = await db.lockIns.get(lockInId);
  if (!lockIn) return null;
  const [checkIns, workouts, milestones, photoCount, journalCount] = await Promise.all([
    db.checkIns.where('lockInId').equals(lockInId).toArray(),
    db.workouts.where('lockInId').equals(lockInId).toArray(),
    db.milestones.where('lockInId').equals(lockInId).sortBy('achievedAt'),
    db.photos.where('lockInId').equals(lockInId).count(),
    db.journal.where('lockInId').equals(lockInId).count(),
  ]);
  const end = lockIn.status === 'completed' ? lockIn.targetDate : minDate(todayISO(), lockIn.targetDate);
  const range = { start: lockIn.startDate, end };
  const records = workouts.map(toTrainingRecord);
  const t = trainingSummary(checkIns, records, range);
  const s = sleepStats(checkIns, range);
  const byDate = new Map(checkIns.map((c) => [c.date, c]));
  const days = eachDay(lockIn.startDate, lockIn.targetDate);
  return {
    lockIn,
    goals: lockIn.goals.map((g) => GOAL_META[g].label),
    totalDays: days.length,
    elapsedDays: eachDay(lockIn.startDate, end).length,
    checkIns: checkIns.length,
    mosaic: days.map((d) => {
      const c = byDate.get(d);
      return c ? (c.rating ?? 'logged') : null;
    }),
    sessions: t.sessions,
    sets: totalSets(records, range),
    restDays: t.restDays,
    sleepAvg: s.avg,
    sleepNights: s.nights,
    firstWeekSleep: sleepStats(checkIns, { start: lockIn.startDate, end: addDays(lockIn.startDate, 6) }).avg,
    lastWeekSleep: sleepStats(checkIns, { start: addDays(end, -6), end }).avg,
    milestones,
    photoCount,
    journalCount,
  };
}
