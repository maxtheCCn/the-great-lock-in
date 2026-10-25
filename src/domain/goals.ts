import type { CheckIn, MiniGoal } from '@/data/types';
import type { TrainingRecord } from '@/data/training/source';
import { filterRange, trainingSummary } from './analytics';

export interface GoalProgress {
  current: number;
  target: number;
  pct: number;
  reached: boolean;
}

export function goalProgress(goal: MiniGoal, checkIns: CheckIn[], workouts: TrainingRecord[]): GoalProgress {
  const r = { start: goal.startDate, end: goal.endDate };
  const cs = filterRange(checkIns, r);
  let current = 0;
  switch (goal.metric) {
    case 'manual':
      current = goal.manualProgress;
      break;
    case 'checkins':
      current = cs.length;
      break;
    case 'workouts':
      current = trainingSummary(checkIns, workouts, r).sessions;
      break;
    case 'sleepNights':
      current = cs.filter((c) => c.sleepHours !== null && c.sleepHours >= (goal.sleepThreshold ?? 7)).length;
      break;
    case 'habit':
      current = cs.filter((c) => goal.habitId && c.habits?.[goal.habitId]).length;
      break;
  }
  const target = Math.max(1, goal.target);
  return { current, target, pct: Math.min(1, current / target), reached: current >= target };
}

export const GOAL_METRIC_LABELS: Record<MiniGoal['metric'], string> = {
  manual: 'Track manually',
  checkins: 'Check-ins completed',
  workouts: 'Workouts recorded',
  sleepNights: 'Nights of good sleep',
  habit: 'Habit completed',
};
