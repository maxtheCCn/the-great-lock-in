/**
 * Builds the data context shared with the coach — only categories the user allowed.
 * Photos are never included.
 */
import { db } from '@/data/db';
import { getSettings } from '@/data/settings';
import { toTrainingRecord } from '@/data/training/source';
import { MUSCLE_BY_ID, MUSCLE_IDS } from '@/data/training/muscles';
import type { CoachSettings, LockIn } from '@/data/types';
import { addDays, minDate, todayISO } from '@/domain/dates';
import { muscleVolume, sleepStats } from '@/domain/analytics';
import { buildWeeklyReview, lockInWeeks } from '@/domain/weekly';
import { lockInTimeline } from '@/domain/timeline';
import { measurementLabel } from '@/domain/measurements';
import { GOAL_META } from '@/components/icons';
import { FOOD_LABEL, TRAINING_SHORT } from '@/components/ratings';

export async function buildCoachContext(lockIn: LockIn, coach: CoachSettings): Promise<string> {
  const today = todayISO();
  const settings = await getSettings();
  const t = lockInTimeline(lockIn);
  const [checkIns, workouts, milestones, measurements, journal, memories] = await Promise.all([
    db.checkIns.where('lockInId').equals(lockIn.id).sortBy('date'),
    db.workouts.where('lockInId').equals(lockIn.id).sortBy('date'),
    db.milestones.where('lockInId').equals(lockIn.id).toArray(),
    coach.share.measurements ? db.measurements.where('lockInId').equals(lockIn.id).sortBy('date') : Promise.resolve([]),
    coach.share.journal ? db.journal.where('lockInId').equals(lockIn.id).reverse().sortBy('date') : Promise.resolve([]),
    coach.memoryEnabled ? db.memories.toArray() : Promise.resolve([]),
  ]);
  const records = workouts.map(toTrainingRecord);
  const lines: string[] = [];

  lines.push(`# Lock In`);
  lines.push(`Name: ${lockIn.name}. ${lockIn.startDate} → ${lockIn.targetDate} (day ${t.dayNumber} of ${t.totalDays}, ${t.daysRemaining} days remaining). Today: ${today}.`);
  lines.push(`Goals: ${lockIn.goals.map((g) => GOAL_META[g].label).join(', ')}.`);
  if (lockIn.motivation) lines.push(`Motivation: "${lockIn.motivation}"`);
  lines.push(`Experience: ${lockIn.experience}. Planned sessions/week: ${lockIn.weeklyFrequency}. Preferences: ${lockIn.preferences.join(', ') || 'none given'}.`);
  lines.push(`Age group: ${settings.ageGroup}. Units: ${settings.units}.`);
  if (lockIn.habits.length) lines.push(`Tracked habits: ${lockIn.habits.map((h) => h.label).join(', ')}.`);

  if (coach.share.checkins) {
    lines.push(`\n# Weekly summaries (deterministic, from records)`);
    const input = { lockIn, checkIns, workouts: records, milestones, measurements, journal, photos: [] };
    for (const w of lockInWeeks(lockIn, today).slice(0, 12).reverse()) {
      const r = buildWeeklyReview(input, w, today);
      lines.push(
        `- Week of ${w}${r.complete ? '' : ' (in progress)'}: check-ins ${r.checkIns}/${r.days.length}, sessions ${r.training.sessions}, rest ${r.training.restDays}, missed ${r.training.missed}, logged sets ${r.sets}, sleep avg ${r.sleep.avg === null ? 'not recorded' : `${r.sleep.avg.toFixed(1)}h (${r.sleep.nights} nights)`}, ratings great/good/okay/tough/unrated ${r.ratings.great}/${r.ratings.good}/${r.ratings.okay}/${r.ratings.tough}/${r.ratings.unrated}.`,
      );
    }
    lines.push(`\n# Daily check-ins, last 21 days (date | sleep h | training | food | day rating)`);
    for (const c of checkIns.filter((c) => c.date >= addDays(today, -20))) {
      lines.push(`${c.date} | ${c.sleepHours ?? '—'} | ${c.training ? TRAINING_SHORT[c.training] : '—'} | ${c.food ? FOOD_LABEL[c.food] : '—'} | ${c.rating ?? 'unrated'}${c.note ? ` | note: ${c.note.slice(0, 120)}` : ''}`);
    }
    const s = sleepStats(checkIns);
    lines.push(`Whole Lock In sleep: ${s.avg === null ? 'not recorded' : `${s.avg.toFixed(2)}h avg over ${s.nights} nights`}.`);
  }

  if (coach.share.workouts) {
    lines.push(`\n# Training volume by muscle group (weighted sets: primary 1, secondary 0.5)`);
    const end = minDate(today, lockIn.targetDate);
    const periods: [string, { start: string; end: string }][] = [
      ['last 7 days', { start: addDays(end, -6), end }],
      ['previous 7 days', { start: addDays(end, -13), end: addDays(end, -7) }],
      ['last 28 days', { start: addDays(end, -27), end }],
    ];
    for (const [label, r] of periods) {
      const v = muscleVolume(records, r);
      const parts = MUSCLE_IDS.filter((id) => v[id].sets > 0).map((id) => `${MUSCLE_BY_ID[id].label} ${v[id].sets}`);
      lines.push(`- ${label}: ${parts.join(', ') || 'no logged sets'}`);
    }
    lines.push(`\n# Logged workouts, last 28 days`);
    for (const w of records.filter((w) => w.date >= addDays(today, -27))) {
      lines.push(`- ${w.date} ${w.title}${w.durationMin ? ` (${w.durationMin} min)` : ''}: ${w.exercises.map((e) => `${e.name} ${e.sets}×${e.reps ?? '?'}${e.weight ? ` @${e.weight}kg` : ''}`).join('; ')}`);
    }
  }

  if (coach.share.measurements && measurements.length) {
    lines.push(`\n# Body measurements (cm)`);
    for (const m of measurements.slice(-30)) lines.push(`- ${m.date} ${measurementLabel(m.kind, settings.customMeasurements)}: ${m.valueCm}`);
  }

  if (coach.share.journal && journal.length) {
    lines.push(`\n# Recent journal entries (private, shared with permission)`);
    for (const j of journal.slice(0, 5)) lines.push(`- ${j.date} energy ${j.energy ?? '—'}/5, motivation ${j.motivation ?? '—'}/5, recovery ${j.recovery ?? '—'}/5: ${(j.body || j.training).slice(0, 300)}`);
  }

  if (memories.length) {
    lines.push(`\n# Coach memory (saved earlier, user can edit)`);
    for (const m of memories) lines.push(`- [${m.category}] ${m.text}`);
  }

  const shared = Object.entries(coach.share)
    .filter(([, v]) => v)
    .map(([k]) => k);
  lines.push(`\n(Data categories shared: ${shared.join(', ') || 'none'}. Progress photos are never shared.)`);
  return lines.join('\n');
}
