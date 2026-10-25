/** Local calendar date in `YYYY-MM-DD` form. Never a UTC timestamp. */
export type ISODate = string;
export type ID = string;

/* ── Lock In ─────────────────────────────────────────────── */

export type GoalId = 'muscle' | 'strength' | 'endurance' | 'consistency' | 'recovery' | 'fitness';
export type Experience = 'new' | 'some' | 'experienced' | 'advanced';
export type TrainingPreference =
  | 'gym'
  | 'home'
  | 'calisthenics'
  | 'running'
  | 'sports'
  | 'mobility';
export type AgeGroup = 'under16' | '16to17' | 'adult' | 'unspecified';

export type HabitIcon =
  | 'water'
  | 'steps'
  | 'stretch'
  | 'read'
  | 'meditate'
  | 'sun'
  | 'noscreen'
  | 'veg'
  | 'walk'
  | 'custom';

export interface HabitDef {
  id: string;
  label: string;
  icon: HabitIcon;
}

export interface LockIn {
  id: ID;
  name: string;
  startDate: ISODate;
  targetDate: ISODate;
  motivation: string;
  goals: GoalId[];
  experience: Experience;
  /** Preferred training sessions per week. */
  weeklyFrequency: number;
  preferences: TrainingPreference[];
  habits: HabitDef[];
  status: 'active' | 'completed';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

/* ── Daily check-in ──────────────────────────────────────── */

export type TrainingStatus = 'workout' | 'rest' | 'missed';
export type FoodLevel = 1 | 2 | 3 | 4;
export type DayRating = 'great' | 'good' | 'okay' | 'tough';

export interface CheckIn {
  id: ID;
  lockInId: ID;
  date: ISODate;
  /** Hours slept the night before. `null` = not recorded (never treated as 0). */
  sleepHours: number | null;
  training: TrainingStatus | null;
  food: FoodLevel | null;
  creatine: boolean | null;
  protein: boolean | null;
  habits: Record<string, boolean>;
  /** Manually chosen by the user. Never assigned automatically. */
  rating: DayRating | null;
  note: string;
  createdAt: number;
  updatedAt: number;
}

/* ── Training ────────────────────────────────────────────── */

export type MuscleId =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'traps'
  | 'lats'
  | 'lowerBack'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export interface WorkoutExercise {
  id: string;
  exerciseId?: string;
  name: string;
  primary: MuscleId[];
  secondary: MuscleId[];
  sets: number;
  reps: number | null;
  weight: number | null;
}

export type WorkoutSourceKind = 'manual' | 'demo' | 'coach';

export interface Workout {
  id: ID;
  lockInId: ID;
  date: ISODate;
  title: string;
  durationMin: number | null;
  exercises: WorkoutExercise[];
  note: string;
  source: WorkoutSourceKind;
  createdAt: number;
  updatedAt: number;
}

/* ── Body ────────────────────────────────────────────────── */

export type BuiltInMeasurement = 'arm' | 'chest' | 'waist' | 'hip' | 'thigh';

export interface Measurement {
  id: ID;
  lockInId: ID;
  date: ISODate;
  /** A built-in kind or the id of a custom measurement type. */
  kind: string;
  /** Always stored in centimetres; converted for display. */
  valueCm: number;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export type PhotoAngle = 'front' | 'side' | 'back';

export interface ProgressPhoto {
  id: ID;
  lockInId: ID;
  date: ISODate;
  angle: PhotoAngle;
  /**
   * Small preview. The full image lives in `photoBlobs` so lists stay light.
   * Stored as ArrayBuffer (not Blob) for reliable IndexedDB support in Safari.
   */
  thumb: ArrayBuffer;
  mime: string;
  width: number;
  height: number;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface PhotoBlob {
  id: ID;
  data: ArrayBuffer;
}

export interface PhotoComparison {
  id: ID;
  lockInId: ID;
  beforeId: ID;
  afterId: ID;
  note: string;
  createdAt: number;
  updatedAt: number;
}

/* ── Motivation & history ────────────────────────────────── */

export interface MilestoneRecord {
  id: ID;
  lockInId: ID;
  key: string;
  achievedAt: number;
  seen: boolean;
}

export type GoalMetric = 'manual' | 'checkins' | 'workouts' | 'sleepNights' | 'habit';

export interface MiniGoal {
  id: ID;
  lockInId: ID;
  title: string;
  metric: GoalMetric;
  target: number;
  /** Only used for `manual` goals. */
  manualProgress: number;
  /** For `sleepNights`: count nights with at least this many hours. */
  sleepThreshold: number | null;
  habitId: string | null;
  startDate: ISODate;
  endDate: ISODate;
  status: 'active' | 'completed' | 'archived';
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type Scale5 = 1 | 2 | 3 | 4 | 5;

export interface JournalEntry {
  id: ID;
  lockInId: ID;
  date: ISODate;
  energy: Scale5 | null;
  motivation: Scale5 | null;
  recovery: Scale5 | null;
  training: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

/* ── Settings ────────────────────────────────────────────── */

export type WidgetId =
  | 'checkin'
  | 'stats'
  | 'pulse'
  | 'habits'
  | 'goals'
  | 'milestones'
  | 'review'
  | 'muscles'
  | 'journal';

export type StatId = 'checkins' | 'workouts' | 'sleep' | 'restDays' | 'milestones' | 'habits';

export type EffectsLevel = 'full' | 'reduced' | 'minimal';

export interface CustomMeasurementType {
  id: string;
  label: string;
}

export interface AppSettings {
  onboarded: boolean;
  profileName: string;
  units: 'metric' | 'imperial';
  ageGroup: AgeGroup;
  showSupplements: boolean;
  dashboard: { order: WidgetId[]; hidden: WidgetId[]; stats: StatId[] };
  effects: EffectsLevel;
  photoBlur: boolean;
  reminder: { enabled: boolean; time: string };
  customMeasurements: CustomMeasurementType[];
  installHintDismissed: boolean;
}

/* ── Coach (optional AI) ─────────────────────────────────── */

export type ProviderId = 'anthropic' | 'openai' | 'gemini';

export interface CoachSettings {
  provider: ProviderId | null;
  model: string;
  keyStorage: 'device' | 'session';
  saveHistory: boolean;
  memoryEnabled: boolean;
  share: { checkins: boolean; workouts: boolean; measurements: boolean; journal: boolean };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  error?: boolean;
  /** A workout suggestion extracted from this reply. */
  suggestionId?: string;
  /** Memories saved from this reply (text, for display). */
  memories?: string[];
}

export interface ChatThread {
  id: ID;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type MemoryCategory = 'goal' | 'preference' | 'pattern' | 'recommendation' | 'workout' | 'other';

export interface CoachMemory {
  id: ID;
  text: string;
  category: MemoryCategory;
  source: 'coach' | 'user';
  createdAt: number;
  updatedAt: number;
}

export interface SuggestedExercise {
  name: string;
  sets: number;
  reps: string;
  restSec: number | null;
  notes: string;
}

export interface SuggestedWorkout {
  id: ID;
  title: string;
  focus: string;
  explanation: string;
  exercises: SuggestedExercise[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

export interface CoachReport {
  id: ID;
  weekStart: ISODate;
  content: string;
  model: string;
  createdAt: number;
}
