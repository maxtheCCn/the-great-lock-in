import {
  Activity,
  BookOpen,
  Brain,
  CalendarCheck,
  Camera,
  ChartColumn,
  Crown,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Leaf,
  MonitorOff,
  Moon,
  PenLine,
  PersonStanding,
  Ruler,
  Salad,
  Shield,
  Sparkles,
  Sun,
  Target,
  TreePine,
  Trophy,
  Weight,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { GoalId, HabitIcon, TrainingPreference } from '@/data/types';
import type { MilestoneIcon } from '@/domain/milestones';

export const HABIT_ICONS: Record<HabitIcon, LucideIcon> = {
  water: Droplet,
  steps: Footprints,
  stretch: PersonStanding,
  read: BookOpen,
  meditate: Brain,
  sun: Sun,
  noscreen: MonitorOff,
  veg: Salad,
  walk: TreePine,
  custom: Sparkles,
};

export const GOAL_META: Record<GoalId, { label: string; desc: string; icon: LucideIcon }> = {
  muscle: { label: 'Build muscle', desc: 'Progressive training and enough recovery.', icon: Dumbbell },
  strength: { label: 'Improve strength', desc: 'Get stronger on the lifts that matter to you.', icon: Weight },
  endurance: { label: 'Improve endurance', desc: 'Go longer, recover faster.', icon: HeartPulse },
  consistency: { label: 'Improve consistency', desc: 'Show up, day after day.', icon: CalendarCheck },
  recovery: { label: 'Improve recovery', desc: 'Sleep, rest days and feeling fresh.', icon: Moon },
  fitness: { label: 'General fitness', desc: 'Move well and feel capable.', icon: Activity },
};

export const PREFERENCE_META: Record<TrainingPreference, { label: string; icon: LucideIcon }> = {
  gym: { label: 'Gym', icon: Dumbbell },
  home: { label: 'Home workouts', icon: Zap },
  calisthenics: { label: 'Calisthenics', icon: PersonStanding },
  running: { label: 'Running', icon: Footprints },
  sports: { label: 'Sports', icon: Trophy },
  mobility: { label: 'Mobility & yoga', icon: Leaf },
};

export const MILESTONE_ICONS: Record<MilestoneIcon, LucideIcon> = {
  spark: Sparkles,
  flame: Flame,
  shield: Shield,
  crown: Crown,
  dumbbell: Dumbbell,
  moon: Moon,
  leaf: Leaf,
  chart: ChartColumn,
  camera: Camera,
  ruler: Ruler,
  pen: PenLine,
  target: Target,
  half: Activity,
  trophy: Trophy,
};
