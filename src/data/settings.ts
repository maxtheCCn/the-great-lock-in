import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { AppSettings, CoachSettings, StatId, WidgetId } from './types';

export const ALL_WIDGETS: WidgetId[] = ['checkin', 'stats', 'pulse', 'habits', 'goals', 'milestones', 'review', 'muscles', 'journal'];
export const ALL_STATS: StatId[] = ['checkins', 'workouts', 'sleep', 'restDays', 'milestones', 'habits'];

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  profileName: '',
  units: 'metric',
  ageGroup: 'unspecified',
  showSupplements: true,
  dashboard: {
    order: [...ALL_WIDGETS],
    hidden: ['journal'],
    stats: ['checkins', 'workouts', 'sleep', 'milestones'],
  },
  effects: 'full',
  photoBlur: false,
  reminder: { enabled: false, time: '20:30' },
  customMeasurements: [],
  installHintDismissed: false,
};

export const DEFAULT_COACH: CoachSettings = {
  provider: null,
  model: '',
  keyStorage: 'device',
  saveHistory: true,
  memoryEnabled: true,
  share: { checkins: true, workouts: true, measurements: false, journal: false },
};

function mergeSettings(stored: Partial<AppSettings> | undefined): AppSettings {
  const s = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  // Keep widget order complete if new widgets ship in a later version.
  const order = s.dashboard.order.filter((w) => ALL_WIDGETS.includes(w));
  for (const w of ALL_WIDGETS) if (!order.includes(w)) order.push(w);
  s.dashboard = { ...DEFAULT_SETTINGS.dashboard, ...s.dashboard, order };
  s.reminder = { ...DEFAULT_SETTINGS.reminder, ...s.reminder };
  return s;
}

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.get('app');
  return mergeSettings(row?.value as Partial<AppSettings> | undefined);
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings();
    await db.settings.put({ key: 'app', value: { ...current, ...patch } });
  });
}

/** Returns undefined while loading. */
export function useSettings(): AppSettings | undefined {
  return useLiveQuery(getSettings, []);
}

export async function getCoachSettings(): Promise<CoachSettings> {
  const row = await db.settings.get('coach');
  const v = (row?.value ?? {}) as Partial<CoachSettings>;
  return { ...DEFAULT_COACH, ...v, share: { ...DEFAULT_COACH.share, ...(v.share ?? {}) } };
}

export async function updateCoachSettings(patch: Partial<CoachSettings>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getCoachSettings();
    await db.settings.put({ key: 'coach', value: { ...current, ...patch } });
  });
}

export function useCoachSettings(): CoachSettings | undefined {
  return useLiveQuery(getCoachSettings, []);
}
