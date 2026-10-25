import { create } from 'zustand';

export type Tab = 'home' | 'calendar' | 'progress' | 'coach' | 'profile';
export const TABS: Tab[] = ['home', 'calendar', 'progress', 'coach', 'profile'];

export type RouteName =
  | Tab
  // progress
  | 'sleep'
  | 'measurements'
  | 'measurement'
  | 'photos'
  | 'studio'
  | 'muscles'
  | 'balance'
  | 'workouts'
  | 'milestones'
  | 'goals'
  | 'journal'
  | 'journalEntry'
  | 'reviews'
  | 'review'
  // profile
  | 'settingsLockIn'
  | 'settingsTraining'
  | 'settingsHabits'
  | 'settingsReminders'
  | 'settingsDashboard'
  | 'settingsAppearance'
  | 'settingsPrivacy'
  | 'settingsData'
  | 'settingsCoach'
  | 'archive'
  | 'archived'
  | 'install'
  | 'newLockIn'
  // coach
  | 'coachChat'
  | 'coachHistory'
  | 'coachMemory'
  | 'coachWeekly'
  | 'coachWorkouts';

export interface Route {
  name: RouteName;
  params?: Record<string, string>;
  key: number;
}

interface NavState {
  tab: Tab;
  stacks: Record<Tab, Route[]>;
  /** +1 when pushing deeper, -1 when popping; drives transition direction. */
  direction: 1 | -1 | 0;
  setTab: (tab: Tab) => void;
  push: (name: RouteName, params?: Record<string, string>) => void;
  pop: () => void;
  popToRoot: () => void;
  replace: (name: RouteName, params?: Record<string, string>) => void;
}

let seq = 1;
const root = (t: Tab): Route[] => [{ name: t, key: seq++ }];

export const useNav = create<NavState>((set, get) => ({
  tab: 'home',
  stacks: { home: root('home'), calendar: root('calendar'), progress: root('progress'), coach: root('coach'), profile: root('profile') },
  direction: 0,
  setTab: (tab) => {
    if (tab === get().tab) {
      get().popToRoot();
      return;
    }
    set({ tab, direction: 0 });
  },
  push: (name, params) => {
    const { tab, stacks } = get();
    set({ stacks: { ...stacks, [tab]: [...stacks[tab], { name, params, key: seq++ }] }, direction: 1 });
    try {
      history.pushState({ tgli: true }, '');
    } catch {
      /* ignore */
    }
  },
  pop: () => {
    const { tab, stacks } = get();
    if (stacks[tab].length <= 1) return;
    set({ stacks: { ...stacks, [tab]: stacks[tab].slice(0, -1) }, direction: -1 });
  },
  popToRoot: () => {
    const { tab, stacks } = get();
    if (stacks[tab].length <= 1) return;
    set({ stacks: { ...stacks, [tab]: stacks[tab].slice(0, 1) }, direction: -1 });
  },
  replace: (name, params) => {
    const { tab, stacks } = get();
    const s = stacks[tab];
    set({ stacks: { ...stacks, [tab]: [...s.slice(0, -1), { name, params, key: seq++ }] }, direction: 1 });
  },
}));

/** Navigate to a tab and optionally push a route onto it. */
export function go(tab: Tab, name?: RouteName, params?: Record<string, string>) {
  const nav = useNav.getState();
  if (nav.tab !== tab) useNav.setState({ tab, direction: 0 });
  if (name && name !== tab) nav.push(name, params);
}

/** Back button handler: prefer history so hardware/gesture back stays in sync. */
export function goBack() {
  if (history.state?.tgli) history.back();
  else useNav.getState().pop();
}

export function installHistorySync() {
  const onPop = () => useNav.getState().pop();
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}
