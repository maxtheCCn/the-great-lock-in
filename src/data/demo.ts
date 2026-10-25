/**
 * Demonstration data. Only ever written to the separate `tgli-demo` database,
 * which the app labels with a persistent "Demo data" banner.
 */
import { db, uid } from './db';
import { EXERCISE_BY_ID } from './training/exercises';
import type { CheckIn, DayRating, FoodLevel, HabitDef, JournalEntry, LockIn, Measurement, MiniGoal, Scale5, TrainingStatus, Workout } from './types';
import { addDays, eachDay, startOfWeek, todayISO, weekday } from '@/domain/dates';
import { DEFAULT_SETTINGS } from './settings';
import { addPhoto, runMilestones } from './repo';
import { useUI } from '@/state/ui';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPLITS: Record<string, [string, number][]> = {
  push: [
    ['bench-press', 4],
    ['overhead-press', 3],
    ['incline-db-press', 3],
    ['lateral-raise', 3],
    ['tricep-pushdown', 3],
  ],
  pull: [
    ['pull-up', 4],
    ['barbell-row', 3],
    ['face-pull', 3],
    ['bicep-curl', 3],
    ['hammer-curl', 2],
  ],
  legs: [
    ['squat', 4],
    ['rdl', 3],
    ['leg-press', 3],
    ['leg-curl', 3],
    ['calf-raise', 4],
    ['plank', 2],
  ],
  upper: [
    ['bench-press', 3],
    ['cable-row', 3],
    ['overhead-press', 3],
    ['lat-pulldown', 3],
    ['skull-crusher', 2],
    ['bicep-curl', 2],
  ],
};

async function demoPhoto(week: number, angle: 'front' | 'side' | 'back'): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 800;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, 800);
  bg.addColorStop(0, '#16231b');
  bg.addColorStop(1, '#070b09');
  g.fillStyle = bg;
  g.fillRect(0, 0, 600, 800);
  const w = angle === 'side' ? 0.62 : 1;
  const fill = `rgba(${90 + week * 6}, ${170 + week * 4}, 120, 0.55)`;
  g.fillStyle = fill;
  const ell = (x: number, y: number, rx: number, ry: number) => {
    g.beginPath();
    g.ellipse(300 + (x - 300) * w, y, rx * w, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  ell(300, 150, 52, 62);
  ell(300, 330, 120 + week * 2, 150);
  ell(300, 520, 100, 90);
  ell(250, 660, 44, 140);
  ell(350, 660, 44, 140);
  if (angle !== 'side') {
    ell(160 - week, 340, 34, 130);
    ell(440 + week, 340, 34, 130);
  }
  g.fillStyle = 'rgba(242, 204, 92, 0.9)';
  g.font = '600 26px monospace';
  g.textAlign = 'center';
  g.fillText(`DEMO PHOTO · WEEK ${week + 1}`, 300, 760);
  g.fillStyle = 'rgba(245,255,247,0.6)';
  g.font = '500 20px monospace';
  g.fillText(angle.toUpperCase(), 300, 60);
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.85));
}

export async function seedDemo(): Promise<void> {
  if ((await db.lockIns.count()) > 0) return;
  const r = rng(20261025);
  const today = todayISO();
  const start = addDays(today, -52);
  const now = Date.now();
  const habits: HabitDef[] = [
    { id: 'water', label: 'Drink water', icon: 'water' },
    { id: 'stretch', label: 'Stretch / mobility', icon: 'stretch' },
    { id: 'steps', label: 'Daily steps', icon: 'steps' },
    { id: 'noscreen', label: 'No screens before bed', icon: 'noscreen' },
  ];
  const lockIn: LockIn = {
    id: uid(),
    name: 'Winter Strength Lock In',
    startDate: start,
    targetDate: addDays(start, 89),
    motivation: 'Get properly strong before the new year, and sleep like an adult.',
    goals: ['strength', 'muscle', 'consistency'],
    experience: 'experienced',
    weeklyFrequency: 4,
    preferences: ['gym', 'mobility'],
    habits,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  // A short completed Lock In for the archive.
  const pastStart = addDays(start, -70);
  const past: LockIn = {
    ...lockIn,
    id: uid(),
    name: 'Summer Consistency Challenge',
    startDate: pastStart,
    targetDate: addDays(pastStart, 41),
    motivation: 'Build the habit first.',
    goals: ['consistency', 'fitness'],
    weeklyFrequency: 3,
    status: 'completed',
    completedAt: now - 20 * 86400000,
  };

  const checkIns: CheckIn[] = [];
  const workouts: Workout[] = [];
  const pattern: (keyof typeof SPLITS | 'rest')[] = ['push', 'pull', 'rest', 'legs', 'upper', 'rest', 'rest'];

  const genDays = (li: LockIn, until: string, density: number) => {
    for (const date of eachDay(li.startDate, until)) {
      if (date === today) continue;
      if (r() > density) continue;
      const plan = pattern[weekday(date)];
      let training: TrainingStatus = plan === 'rest' ? 'rest' : r() < 0.88 ? 'workout' : 'missed';
      if (li.id === past.id && plan === 'upper') training = 'rest';
      const sleep = r() < 0.08 ? null : Math.round((7.1 + (r() - 0.45) * 2.2 + (date > addDays(start, 25) ? 0.35 : 0)) * 4) / 4;
      const food = (1 + Math.min(3, Math.floor(r() * 2.4 + (training === 'workout' ? 1.2 : 0.6)))) as FoodLevel;
      const score = (sleep ?? 7) / 8 + (training === 'missed' ? -0.5 : 0.15) + food / 8 + (r() - 0.5) * 0.6;
      const rating: DayRating | null = r() < 0.07 ? null : score > 1.35 ? 'great' : score > 1.05 ? 'good' : score > 0.75 ? 'okay' : 'tough';
      const c: CheckIn = {
        id: uid(),
        lockInId: li.id,
        date,
        sleepHours: sleep,
        training,
        food,
        creatine: training === 'workout' ? r() < 0.8 : r() < 0.4,
        protein: r() < 0.5,
        habits: Object.fromEntries(habits.map((h, i) => [h.id, r() < [0.85, 0.55, 0.7, 0.4][i]])),
        rating,
        note: r() < 0.12 ? ['Felt strong today.', 'Long day at school, short session.', 'Legs still sore from Thursday.', 'Great energy after sleeping 8h.', 'Rest day walk in the sun.'][Math.floor(r() * 5)] : '',
        createdAt: now,
        updatedAt: now,
      };
      checkIns.push(c);
      if (training === 'workout' && plan !== 'rest' && r() < 0.9) {
        workouts.push({
          id: uid(),
          lockInId: li.id,
          date,
          title: `${plan[0].toUpperCase()}${plan.slice(1)} day`,
          durationMin: 45 + Math.round(r() * 35),
          exercises: SPLITS[plan].map(([id, sets]) => {
            const e = EXERCISE_BY_ID[id];
            return { id: uid(), exerciseId: id, name: e.name, primary: e.primary, secondary: e.secondary, sets: sets + (r() < 0.2 ? 1 : 0), reps: 6 + Math.floor(r() * 7), weight: null };
          }),
          note: '',
          source: 'demo',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  };
  genDays(lockIn, addDays(today, -1), 0.9);
  genDays(past, past.targetDate, 0.8);

  const measurements: Measurement[] = [];
  const base: Record<string, number> = { waist: 84, arm: 34.5, chest: 101 };
  for (let i = 0; i * 14 <= 52; i++) {
    const date = addDays(start, i * 14);
    for (const [kind, v] of Object.entries(base)) {
      const delta = kind === 'waist' ? -0.4 * i : 0.35 * i;
      measurements.push({ id: uid(), lockInId: lockIn.id, date, kind, valueCm: Math.round((v + delta + (r() - 0.5) * 0.4) * 10) / 10, note: '', createdAt: now, updatedAt: now });
    }
  }

  const journal: JournalEntry[] = [0, 4, 9, 15, 22, 30, 37, 44, 50].map((d, i) => ({
    id: uid(),
    lockInId: lockIn.id,
    date: addDays(start, d),
    energy: (2 + Math.floor(r() * 4)) as Scale5,
    motivation: (3 + Math.floor(r() * 3)) as Scale5,
    recovery: (2 + Math.floor(r() * 4)) as Scale5,
    training: ['First session done. Starting light.', 'Squats felt smooth.', 'Missed Thursday, rescheduled.', 'Bench moving up.', 'Deload week felt good.', ''][i % 6],
    body: [
      'Day one. Writing this so future me remembers why: consistency over intensity.',
      'Sleep is the thing. Two good nights and everything feels easier.',
      'Busy week with exams. Kept the check-ins even when training was short.',
      'Noticed I actually look forward to the gym now.',
      'Halfway feels close. Keeping it sustainable.',
      'Tough day, but logged it honestly. Red days count too.',
      'New pull-up best. Small win.',
      'Recovery week. Walked a lot, stretched every evening.',
      'Starting to believe the plan works.',
    ][i],
    createdAt: now,
    updatedAt: now,
  }));

  const wk = startOfWeek(today);
  const goals: MiniGoal[] = [
    { id: uid(), lockInId: lockIn.id, title: 'Four workouts this week', metric: 'workouts', target: 4, manualProgress: 0, sleepThreshold: null, habitId: null, startDate: wk, endDate: addDays(wk, 6), status: 'active', createdAt: now, updatedAt: now },
    { id: uid(), lockInId: lockIn.id, title: 'Five nights of 7+ hours', metric: 'sleepNights', target: 5, manualProgress: 0, sleepThreshold: 7, habitId: null, startDate: wk, endDate: addDays(wk, 6), status: 'active', createdAt: now, updatedAt: now },
    { id: uid(), lockInId: lockIn.id, title: 'Stretch 10 times', metric: 'habit', target: 10, manualProgress: 0, sleepThreshold: null, habitId: 'stretch', startDate: start, endDate: addDays(start, 27), status: 'completed', completedAt: now - 25 * 86400000, createdAt: now, updatedAt: now },
  ];

  await db.transaction('rw', [db.lockIns, db.checkIns, db.workouts, db.measurements, db.journal, db.goals, db.settings], async () => {
    await db.lockIns.bulkAdd([lockIn, past]);
    await db.checkIns.bulkAdd(checkIns);
    await db.workouts.bulkAdd(workouts);
    await db.measurements.bulkAdd(measurements);
    await db.journal.bulkAdd(journal);
    await db.goals.bulkAdd(goals);
    await db.settings.put({ key: 'app', value: { ...DEFAULT_SETTINGS, onboarded: true, profileName: 'Demo', reminder: { enabled: true, time: '20:30' } } });
    await db.settings.put({ key: `reviewViewed:${lockIn.id}`, value: now });
  });

  for (let w = 0; w < 7; w += 3) {
    const date = addDays(start, w * 7 + 1);
    for (const angle of ['front', 'side', 'back'] as const) {
      await addPhoto(lockIn.id, await demoPhoto(w, angle), angle, date, w === 0 ? 'Baseline' : '');
    }
  }
  await runMilestones(past.id, { celebrate: false });
  await runMilestones(lockIn.id, { celebrate: false });
  await backdateDemoMilestones([lockIn, past], checkIns, workouts);
  // Sample milestones are history, not fresh achievements: never celebrate them.
  await db.milestones.toCollection().modify({ seen: true });
  useUI.setState({ celebrations: [] });
}

/** Demo only: place each milestone on the day the sample data would have earned it. */
async function backdateDemoMilestones(lockIns: LockIn[], checkIns: CheckIn[], workouts: Workout[]) {
  const at = (d: string | undefined) => (d ? new Date(`${d}T19:30:00`).getTime() : undefined);
  for (const li of lockIns) {
    const cs = checkIns.filter((c) => c.lockInId === li.id).sort((a, b) => a.date.localeCompare(b.date));
    const sessions = [...new Set([...workouts.filter((w) => w.lockInId === li.id).map((w) => w.date), ...cs.filter((c) => c.training === 'workout').map((c) => c.date)])].sort();
    const rests = cs.filter((c) => c.training === 'rest').map((c) => c.date);
    const good = cs.filter((c) => (c.sleepHours ?? 0) >= 7).map((c) => c.date);
    const total = Math.round((new Date(li.targetDate).getTime() - new Date(li.startDate).getTime()) / 86400000) + 1;
    const when: Record<string, number | undefined> = {
      'first-checkin': at(cs[0]?.date),
      'checkins-7': at(cs[6]?.date),
      'checkins-30': at(cs[29]?.date),
      'checkins-60': at(cs[59]?.date),
      'first-workout': at(sessions[0]),
      'workouts-10': at(sessions[9]),
      'workouts-25': at(sessions[24]),
      'rest-5': at(rests[4]),
      'sleep-7': at(good[6]),
      'first-review': at(addDays(li.startDate, 7)),
      'first-measurement': at(li.startDate),
      'first-photo': at(addDays(li.startDate, 1)),
      'first-journal': at(li.startDate),
      'first-goal': at(addDays(li.startDate, 26)),
      halfway: at(addDays(li.startDate, Math.ceil(total / 2))),
      'lockin-complete': li.completedAt,
    };
    const rows = await db.milestones.where('lockInId').equals(li.id).toArray();
    for (const m of rows) {
      const t = when[m.key];
      if (t && t < Date.now()) await db.milestones.update(m.id, { achievedAt: t, seen: true });
    }
  }
}
