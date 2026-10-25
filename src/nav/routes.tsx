import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Route, RouteName } from './store';
import { useActive } from '@/state/lockin';
import { Home } from '@/features/home/Home';

type PageProps = { params: Record<string, string> };
type PageComponent = ComponentType<PageProps>;

const page = (f: () => Promise<{ default: PageComponent }>) => lazy(f);
/** Lazy-load a named export. */
const named = <M extends Record<string, unknown>>(f: () => Promise<M>, key: keyof M) =>
  lazy(() => f().then((m) => ({ default: m[key] as PageComponent })));

const settings = () => import('@/features/profile/SettingsPages');
const progress = () => import('@/features/progress/pages');
const motivation = () => import('@/features/motivation/pages');
const archive = () => import('@/features/archive/ArchivePages');
const coach = () => import('@/features/coach/pages');

/** Code-split pages. Home stays in the main bundle for the fastest first paint. */
const PAGES: Partial<Record<RouteName, LazyExoticComponent<PageComponent>>> = {
  calendar: page(() => import('@/features/calendar/CalendarPage')),
  progress: page(() => import('@/features/progress/ProgressHub')),
  coach: page(() => import('@/features/coach/CoachHome')),
  profile: page(() => import('@/features/profile/ProfilePage')),

  sleep: named(progress, 'SleepPage'),
  measurements: named(progress, 'MeasurementsPage'),
  measurement: named(progress, 'MeasurementDetailPage'),
  photos: named(progress, 'PhotosPage'),
  studio: page(() => import('@/features/progress/studio/StudioPage')),
  muscles: page(() => import('@/features/progress/muscle/MusclePage')),
  balance: named(progress, 'BalancePage'),
  workouts: named(progress, 'WorkoutsPage'),

  milestones: named(motivation, 'MilestonesPage'),
  goals: named(motivation, 'GoalsPage'),
  journal: named(motivation, 'JournalPage'),
  journalEntry: named(motivation, 'JournalEntryPage'),
  reviews: named(motivation, 'ReviewsPage'),
  review: named(motivation, 'ReviewPage'),

  settingsLockIn: named(settings, 'LockInSettings'),
  settingsTraining: named(settings, 'TrainingSettings'),
  settingsHabits: named(settings, 'HabitSettings'),
  settingsReminders: named(settings, 'ReminderSettings'),
  settingsAppearance: named(settings, 'AppearanceSettings'),
  settingsPrivacy: named(settings, 'PrivacySettings'),
  settingsData: named(settings, 'DataSettings'),
  settingsCoach: named(coach, 'CoachSettingsPage'),
  install: named(() => import('@/features/profile/InstallGuide'), 'InstallGuide'),
  archive: named(archive, 'ArchivePage'),
  archived: named(archive, 'ArchivedPage'),

  coachChat: named(coach, 'ChatPage'),
  coachHistory: named(coach, 'HistoryPage'),
  coachMemory: named(coach, 'MemoryPage'),
  coachWeekly: named(coach, 'WeeklyCoachPage'),
  coachWorkouts: named(coach, 'WorkoutSuggestionsPage'),
};

function HomeRoute() {
  const lockIn = useActive();
  return <Home lockIn={lockIn} />;
}

export function RouteView({ route }: { route: Route }) {
  if (route.name === 'home') return <HomeRoute />;
  const P = PAGES[route.name];
  if (!P) return null;
  return <P params={route.params ?? {}} />;
}
