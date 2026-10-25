/**
 * Milestones are earned only from actually recorded events.
 * None reward restriction, extreme volume or appearance.
 */
export interface MilestoneContext {
  checkIns: number;
  sessions: number;
  restDays: number;
  goodSleepNights: number;
  photos: number;
  measurements: number;
  journal: number;
  goalsCompleted: number;
  reviewViewed: boolean;
  elapsed: number;
  completed: boolean;
}

export type MilestoneIcon =
  | 'spark'
  | 'flame'
  | 'shield'
  | 'crown'
  | 'dumbbell'
  | 'moon'
  | 'leaf'
  | 'chart'
  | 'camera'
  | 'ruler'
  | 'pen'
  | 'target'
  | 'half'
  | 'trophy';

export interface MilestoneDef {
  key: string;
  title: string;
  description: string;
  icon: MilestoneIcon;
  tier: 1 | 2 | 3;
  check: (c: MilestoneContext) => boolean;
}

export const MILESTONES: MilestoneDef[] = [
  { key: 'first-checkin', title: 'First Check-in', description: 'You logged your very first day.', icon: 'spark', tier: 1, check: (c) => c.checkIns >= 1 },
  { key: 'checkins-7', title: 'Seven Strong', description: '7 completed check-ins.', icon: 'flame', tier: 1, check: (c) => c.checkIns >= 7 },
  { key: 'checkins-30', title: 'Thirty Days Logged', description: '30 completed check-ins.', icon: 'shield', tier: 2, check: (c) => c.checkIns >= 30 },
  { key: 'checkins-60', title: 'Sixty Days Logged', description: '60 completed check-ins.', icon: 'shield', tier: 2, check: (c) => c.checkIns >= 60 },
  { key: 'checkins-100', title: 'Centurion', description: '100 completed check-ins.', icon: 'crown', tier: 3, check: (c) => c.checkIns >= 100 },
  { key: 'first-workout', title: 'First Session', description: 'Your first recorded workout.', icon: 'dumbbell', tier: 1, check: (c) => c.sessions >= 1 },
  { key: 'workouts-10', title: 'Ten Sessions', description: '10 recorded workouts.', icon: 'dumbbell', tier: 2, check: (c) => c.sessions >= 10 },
  { key: 'workouts-25', title: 'Twenty-Five Sessions', description: '25 recorded workouts.', icon: 'dumbbell', tier: 2, check: (c) => c.sessions >= 25 },
  { key: 'workouts-50', title: 'Fifty Sessions', description: '50 recorded workouts.', icon: 'trophy', tier: 3, check: (c) => c.sessions >= 50 },
  { key: 'rest-5', title: 'Recovery Counts', description: '5 planned rest days logged. Rest is training too.', icon: 'leaf', tier: 1, check: (c) => c.restDays >= 5 },
  { key: 'sleep-7', title: 'Well Rested', description: '7 nights of 7+ hours recorded.', icon: 'moon', tier: 1, check: (c) => c.goodSleepNights >= 7 },
  { key: 'first-review', title: 'First Weekly Review', description: 'You looked back at a full week.', icon: 'chart', tier: 1, check: (c) => c.reviewViewed },
  { key: 'first-photo', title: 'Snapshot', description: 'Your first private progress photo.', icon: 'camera', tier: 1, check: (c) => c.photos >= 1 },
  { key: 'first-measurement', title: 'Baseline Set', description: 'Your first body measurement.', icon: 'ruler', tier: 1, check: (c) => c.measurements >= 1 },
  { key: 'first-journal', title: 'First Entry', description: 'Your first journal reflection.', icon: 'pen', tier: 1, check: (c) => c.journal >= 1 },
  { key: 'first-goal', title: 'Goal Reached', description: 'You completed a mini goal.', icon: 'target', tier: 1, check: (c) => c.goalsCompleted >= 1 },
  { key: 'halfway', title: 'Halfway There', description: 'Half of your Lock In is behind you.', icon: 'half', tier: 2, check: (c) => c.elapsed >= 0.5 },
  { key: 'lockin-complete', title: 'Lock In Complete', description: 'You saw your Lock In through to the end.', icon: 'trophy', tier: 3, check: (c) => c.completed },
];

export const MILESTONE_BY_KEY = Object.fromEntries(MILESTONES.map((m) => [m.key, m])) as Record<string, MilestoneDef>;

export function earnedMilestones(ctx: MilestoneContext): string[] {
  return MILESTONES.filter((m) => m.check(ctx)).map((m) => m.key);
}
