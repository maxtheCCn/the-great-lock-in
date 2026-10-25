import type { LockIn } from '@/data/types';
import { addDays, diffDays, parseISO, toISO } from './dates';

export interface Timeline {
  phase: 'upcoming' | 'active' | 'ended';
  /** Calendar days in the Lock In, start and target inclusive. */
  totalDays: number;
  /** Days fully behind you (today is still in progress). */
  daysCompleted: number;
  /** Days after today up to and including the target date. */
  daysRemaining: number;
  /** 1-based day number today, clamped to the Lock In. */
  dayNumber: number;
  /** Share of wall-clock time elapsed, 0–1. Time progress only — not physical progress. */
  elapsed: number;
  startsIn: number;
  startMs: number;
  endMs: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function lockInTimeline(lockIn: Pick<LockIn, 'startDate' | 'targetDate'>, now: Date = new Date()): Timeline {
  const today = toISO(now);
  const totalDays = Math.max(1, diffDays(lockIn.startDate, lockIn.targetDate) + 1);
  const startMs = parseISO(lockIn.startDate).getTime();
  const endMs = parseISO(addDays(lockIn.targetDate, 1)).getTime();
  const sinceStart = diffDays(lockIn.startDate, today);

  let phase: Timeline['phase'] = 'active';
  if (sinceStart < 0) phase = 'upcoming';
  else if (now.getTime() >= endMs) phase = 'ended';

  return {
    phase,
    totalDays,
    daysCompleted: clamp(sinceStart, 0, totalDays),
    daysRemaining: phase === 'upcoming' ? totalDays : phase === 'ended' ? 0 : clamp(diffDays(today, lockIn.targetDate), 0, totalDays),
    dayNumber: clamp(sinceStart + 1, 1, totalDays),
    elapsed: clamp((now.getTime() - startMs) / (endMs - startMs), 0, 1),
    startsIn: Math.max(0, -sinceStart),
    startMs,
    endMs,
  };
}

/** Breaks a millisecond duration into countdown parts. */
export function splitDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}
