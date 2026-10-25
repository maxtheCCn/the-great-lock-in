import { motion } from 'motion/react';
import {
  BedDouble,
  Bell,
  CalendarCheck,
  ChartColumn,
  ChevronRight,
  Dumbbell,
  Leaf,
  ListChecks,
  PenLine,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Utensils,
} from 'lucide-react';
import { useMemo } from 'react';
import type { AppSettings, CheckIn, LockIn, MilestoneRecord, MiniGoal, StatId } from '@/data/types';
import type { TrainingRecord } from '@/data/training/source';
import { Badge, Button, Panel } from '@/design/primitives';
import { AnimatedNumber, ProgressRing } from '@/design/visuals';
import { addDays, eachDay, formatShort, formatWeekday, maxDate, startOfWeek } from '@/domain/dates';
import { eligibleDays, habitStats, muscleVolume, sleepStats, trainingSummary } from '@/domain/analytics';
import { goalProgress } from '@/domain/goals';
import { MILESTONES, MILESTONE_BY_KEY } from '@/domain/milestones';
import type { Timeline } from '@/domain/timeline';
import { isPastReminderTime } from '@/services/reminders';
import { useUI } from '@/state/ui';
import { go } from '@/nav/store';
import { Emblem } from '@/components/Emblem';
import { HABIT_ICONS } from '@/components/icons';
import { FOOD_LABEL, RATING_COLOR, RATING_LABEL, TRAINING_SHORT, UNRATED_COLOR, fmtHours } from '@/components/ratings';
import { BodyMap2D } from '@/features/progress/muscle/BodyMap2D';

export interface HomeData {
  lockIn: LockIn;
  checkIns: CheckIn[];
  training: TrainingRecord[];
  milestones: MilestoneRecord[];
  goals: MiniGoal[];
  journalToday: boolean;
  today: string;
  timeline: Timeline;
  settings: AppSettings;
}

const fullRange = (d: HomeData) => ({ start: d.lockIn.startDate, end: d.today });

/* ── Today's check-in ────────────────────────────────────── */

export function CheckinWidget({ d }: { d: HomeData }) {
  const openSheet = useUI((s) => s.openSheet);
  const today = d.checkIns.find((c) => c.date === d.today);
  const reminderDue = d.settings.reminder.enabled && !today && isPastReminderTime(d.settings.reminder.time);
  const outside = d.timeline.phase !== 'active';

  if (outside && !today) {
    return (
      <Panel eyebrow="Today">
        <p className="t-small">
          {d.timeline.phase === 'upcoming' ? 'Check-ins open on your start date. Use the time to set up your habits and goals.' : 'This Lock In has reached its target date.'}
        </p>
      </Panel>
    );
  }

  if (!today) {
    return (
      <Panel glow className="ci-cta" eyebrow="Today's check-in" action={reminderDue ? <Badge tone="warn" icon={<Bell />}>Reminder</Badge> : <Badge tone="muted">Pending</Badge>}>
        <div className="ci-cta__scan" />
        <div className="t-h2" style={{ marginBottom: 6 }}>
          How did today go?
        </div>
        <p className="t-small" style={{ marginBottom: 18 }}>
          Sleep, training, food and your day's colour. About thirty seconds.
        </p>
        <Button block size="lg" onClick={() => openSheet({ type: 'checkin', date: d.today })}>
          Check in now
        </Button>
      </Panel>
    );
  }

  return (
    <Panel
     
      eyebrow="Today's check-in"
      action={
        <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => openSheet({ type: 'checkin', date: d.today })}>
          Edit
        </Button>
      }
    >
      <div className="row gap-3" style={{ marginBottom: 14 }}>
        <motion.span
          className="rating-dot"
          style={{ width: 16, height: 16, background: today.rating ? RATING_COLOR[today.rating] : 'var(--rate-none)', boxShadow: today.rating ? `0 0 14px ${RATING_COLOR[today.rating]}` : undefined }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        />
        <span className="t-h3">{today.rating ? `${RATING_LABEL[today.rating]} day` : 'Checked in'}</span>
        <Badge>Done</Badge>
      </div>
      <div className="ci-summary">
        <span className="ci-pill">
          <BedDouble /> {fmtHours(today.sleepHours)}
        </span>
        {today.training && (
          <span className="ci-pill">
            {today.training === 'rest' ? <Leaf /> : <Dumbbell />} {TRAINING_SHORT[today.training]}
          </span>
        )}
        {today.food && (
          <span className="ci-pill">
            <Utensils /> {FOOD_LABEL[today.food]}
          </span>
        )}
        {d.lockIn.habits.length > 0 && (
          <span className="ci-pill">
            <ListChecks /> {d.lockIn.habits.filter((h) => today.habits?.[h.id]).length}/{d.lockIn.habits.length}
          </span>
        )}
      </div>
      {today.training === 'workout' && !d.training.some((w) => w.date === d.today) && (
        <button className="row gap-2 t-small" style={{ marginTop: 14, color: 'var(--mint)', fontWeight: 650 }} onClick={() => openSheet({ type: 'workout', date: d.today })}>
          <Plus size={15} /> Add workout details for the muscle map
        </button>
      )}
    </Panel>
  );
}

/* ── Statistics ──────────────────────────────────────────── */

export function StatsWidget({ d }: { d: HomeData }) {
  const r = fullRange(d);
  const days = eligibleDays(r, d.lockIn, d.today);
  const t = useMemo(() => trainingSummary(d.checkIns, d.training, r), [d.checkIns, d.training, r.start, r.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const sleep = sleepStats(d.checkIns, r);
  const hs = habitStats(d.checkIns, d.lockIn.habits, r);
  const habitDone = hs.reduce((a, h) => a + h.done, 0);
  const habitPossible = hs.reduce((a, h) => a + h.recorded, 0);

  const all: Record<StatId, { icon: React.ReactNode; value: number | null; decimals?: number; unit?: string; label: string; sub: string }> = {
    checkins: { icon: <CalendarCheck />, value: d.checkIns.length, label: 'Check-ins', sub: `of ${days.length} day${days.length === 1 ? '' : 's'} so far` },
    workouts: { icon: <Dumbbell />, value: t.sessions, label: 'Workouts recorded', sub: `${t.logged} with details` },
    sleep: { icon: <BedDouble />, value: sleep.avg, decimals: 1, unit: 'h', label: 'Average sleep', sub: sleep.nights ? `${sleep.nights} nights recorded` : 'No nights recorded' },
    restDays: { icon: <Leaf />, value: t.restDays, label: 'Planned rest days', sub: 'Recovery counts' },
    milestones: { icon: <Trophy />, value: d.milestones.length, label: 'Milestones', sub: `of ${MILESTONES.length}` },
    habits: {
      icon: <ListChecks />,
      value: habitPossible ? Math.round((habitDone / habitPossible) * 100) : null,
      unit: '%',
      label: 'Habits completed',
      sub: habitPossible ? `${habitDone} of ${habitPossible} ticks` : 'No habits recorded',
    },
  };
  const ids = d.settings.dashboard.stats.length ? d.settings.dashboard.stats : (['checkins', 'workouts', 'sleep', 'milestones'] as StatId[]);

  return (
    <Panel eyebrow="Statistics" action={<span className="t-eyebrow">Entire Lock In</span>}>
      <div className="stat-grid">
        {ids.map((id) => {
          const s = all[id];
          return (
            <div className="stat" key={id}>
              <span className="stat__icon">{s.icon}</span>
              <div className="stat__value">
                {s.value === null ? <span style={{ color: 'var(--text-4)' }}>—</span> : <AnimatedNumber value={s.value} decimals={s.decimals ?? 0} />}
                {s.unit && s.value !== null && <small>{s.unit}</small>}
              </div>
              <div className="stat__label">{s.label}</div>
              <div className="stat__sub">{s.sub}</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ── Lock In Pulse ───────────────────────────────────────── */

export function PulseWidget({ d }: { d: HomeData }) {
  const days = eachDay(maxDate(addDays(d.today, -13), d.lockIn.startDate), d.today);
  const padded = [...Array(Math.max(0, 14 - days.length)).fill(null), ...days] as (string | null)[];
  const byDate = new Map(d.checkIns.map((c) => [c.date, c]));
  const loggedDates = new Set(d.training.map((w) => w.date));
  const checked = days.filter((x) => byDate.has(x)).length;
  const t = trainingSummary(d.checkIns, d.training, { start: days[0] ?? d.today, end: d.today });

  return (
    <Panel eyebrow="Lock In Pulse" action={<span className="t-eyebrow">Last 14 days</span>}>
      <div className="pulse" role="img" aria-label={`${checked} of the last ${days.length} days checked in`}>
        {padded.map((date, i) => {
          if (!date)
            return (
              <div key={`p${i}`} className="pulse__col" aria-hidden>
                <div className="pulse__bar" style={{ height: 4, background: 'rgba(160,245,184,0.06)' }} />
                <span className="pulse__mark" />
              </div>
            );
          const c = byDate.get(date);
          const h = c ? (c.rating ? 1 : 0.7) : 0.12;
          const color = c?.rating ? RATING_COLOR[c.rating] : c ? 'rgba(160,245,184,0.45)' : 'rgba(160,245,184,0.1)';
          const trained = c?.training === 'workout' || loggedDates.has(date);
          return (
            <div key={date} className="pulse__col" title={formatShort(date)}>
              <motion.div
                className="pulse__bar"
                style={{ height: `${h * 100}%`, background: color, opacity: date === d.today ? 1 : 0.9 }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.15 + i * 0.035, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
              <span
                className="pulse__mark"
                style={{
                  background: trained ? 'var(--mint)' : 'transparent',
                  boxShadow: c?.training === 'rest' ? 'inset 0 0 0 1.5px var(--mint)' : c?.training === 'missed' ? 'inset 0 0 0 1.5px var(--text-4)' : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="pulse__labels" aria-hidden>
        {padded.map((date, i) => (
          <span key={i} className={date === d.today ? 'is-today' : undefined}>
            {date ? formatWeekday(date).slice(0, 1) : ''}
          </span>
        ))}
      </div>
      <div className="divider" />
      <div className="row between wrap gap-3">
        <span className="t-small">
          {days.length < 4 && checked === 0 ? (
            'Your pulse builds as you check in.'
          ) : (
            <>
              <b style={{ color: 'var(--text-1)' }}>{checked}</b> of {days.length} {days.length === 1 ? 'day' : 'days'} checked in · <b style={{ color: 'var(--text-1)' }}>{t.sessions}</b>{' '}
              {t.sessions === 1 ? 'session' : 'sessions'}
            </>
          )}
        </span>
        <div className="legend">
          <span>
            <i style={{ background: 'var(--mint)', borderRadius: '50%' }} />
            Workout
          </span>
          <span>
            <i style={{ boxShadow: 'inset 0 0 0 1.5px var(--mint)', borderRadius: '50%' }} />
            Rest
          </span>
        </div>
      </div>
    </Panel>
  );
}

/* ── Habits ──────────────────────────────────────────────── */

export function HabitsWidget({ d }: { d: HomeData }) {
  const week = eachDay(addDays(d.today, -6), d.today);
  const byDate = new Map(d.checkIns.map((c) => [c.date, c]));
  if (!d.lockIn.habits.length) {
    return (
      <Panel eyebrow="Habits" onPress={() => go('profile', 'settingsHabits')}>
        <div className="row between">
          <span className="t-small">No daily habits yet. Add a few small ones to your check-in.</span>
          <ChevronRight size={18} color="var(--text-3)" />
        </div>
      </Panel>
    );
  }
  return (
    <Panel eyebrow="Habits" action={<span className="t-eyebrow">Last 7 days</span>}>
      {d.lockIn.habits.map((h) => {
        const Icon = HABIT_ICONS[h.icon];
        const done = week.filter((x) => byDate.get(x)?.habits?.[h.id]).length;
        return (
          <div className="habit-row" key={h.id}>
            <span className="habit-row__icon">
              <Icon />
            </span>
            <div className="stack grow">
              <span style={{ fontWeight: 650, fontSize: 14 }}>{h.label}</span>
              <span className="t-small" style={{ fontSize: 12 }}>
                {done}/7 days
              </span>
            </div>
            <div className="habit-row__week" aria-hidden>
              {week.map((x) => (
                <i key={x} data-on={!!byDate.get(x)?.habits?.[h.id]} />
              ))}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

/* ── Mini goals ──────────────────────────────────────────── */

export function GoalsWidget({ d }: { d: HomeData }) {
  const active = d.goals.filter((g) => g.status === 'active').slice(0, 3);
  const openSheet = useUI((s) => s.openSheet);
  return (
    <Panel
     
      eyebrow="Mini goals"
      action={
        <button className="t-eyebrow" style={{ color: 'var(--mint)' }} onClick={() => go('progress', 'goals')}>
          All goals
        </button>
      }
    >
      {active.length === 0 ? (
        <div className="row between gap-3">
          <span className="t-small">Break your Lock In into small wins, like three workouts this week.</span>
          <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => openSheet({ type: 'goal' })}>
            Goal
          </Button>
        </div>
      ) : (
        <div className="stack gap-3">
          {active.map((g, i) => {
            const p = goalProgress(g, d.checkIns, d.training);
            return (
              <div key={g.id} className="row gap-3">
                <ProgressRing value={p.pct} size={44} stroke={4} delay={i * 0.1}>
                  <span className="t-mono" style={{ fontSize: 10 }}>
                    {Math.round(p.pct * 100)}
                  </span>
                </ProgressRing>
                <div className="stack grow">
                  <span style={{ fontWeight: 650, fontSize: 14 }}>{g.title}</span>
                  <span className="t-small" style={{ fontSize: 12 }}>
                    {p.current} of {p.target} · until {formatShort(g.endDate)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ── Milestones ──────────────────────────────────────────── */

export function MilestonesWidget({ d }: { d: HomeData }) {
  const recent = [...d.milestones].sort((a, b) => b.achievedAt - a.achievedAt).slice(0, 6);
  const have = new Set(d.milestones.map((m) => m.key));
  const next = nextMilestone(have);
  return (
    <Panel
     
      eyebrow="Milestones"
      action={
        <button className="t-eyebrow" style={{ color: 'var(--mint)' }} onClick={() => go('progress', 'milestones')}>
          {d.milestones.length}/{MILESTONES.length}
        </button>
      }
    >
      {recent.length > 0 ? (
        <div className="ms-strip">
          {recent.map((m) => (
            <div key={m.id} className="stack" style={{ alignItems: 'center', gap: 6, width: 76, flex: 'none' }}>
              <Emblem milestoneKey={m.key} size={58} />
              <span style={{ fontSize: 11, fontWeight: 650, textAlign: 'center', lineHeight: 1.2 }}>{MILESTONE_BY_KEY[m.key]?.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="t-small">Your first check-in unlocks your first milestone.</p>
      )}
      {next && (
        <div className="next-ms" style={{ marginTop: 14 }}>
          <Emblem milestoneKey={next.key} size={40} locked />
          <div className="stack grow">
            <span className="t-eyebrow" style={{ fontSize: 9 }}>
              Next up
            </span>
            <span style={{ fontWeight: 650, fontSize: 14 }}>{next.title}</span>
            <span className="t-small" style={{ fontSize: 12 }}>
              {next.description}
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function nextMilestone(have: Set<string>) {
  const order = ['first-checkin', 'first-workout', 'checkins-7', 'sleep-7', 'rest-5', 'workouts-10', 'halfway', 'checkins-30', 'workouts-25', 'checkins-60', 'workouts-50', 'checkins-100'];
  const key = order.find((k) => !have.has(k));
  return key ? MILESTONE_BY_KEY[key] : null;
}

/* ── Weekly review teaser ────────────────────────────────── */

export function ReviewWidget({ d }: { d: HomeData }) {
  const lastWeek = addDays(startOfWeek(d.today), -7);
  const hasLastWeek = lastWeek >= startOfWeek(d.lockIn.startDate);
  const target = hasLastWeek ? lastWeek : startOfWeek(d.today);
  const byDate = new Map(d.checkIns.map((c) => [c.date, c]));
  const days = eachDay(target, addDays(target, 6));
  const t = trainingSummary(d.checkIns, d.training, { start: target, end: addDays(target, 6) });
  const sleep = sleepStats(d.checkIns, { start: target, end: addDays(target, 6) });
  return (
    <Panel eyebrow="Weekly review" action={<span className="t-eyebrow">{hasLastWeek ? `Week of ${formatShort(lastWeek)}` : 'This week so far'}</span>} onPress={() => go('progress', 'review', { week: target })}>
      <div className="review-strip" aria-hidden>
        {days.map((day) => {
          const c = byDate.get(day);
          return (
            <span key={day}>
              <i style={{ background: c?.rating ? RATING_COLOR[c.rating] : c ? 'rgba(160,245,184,0.4)' : UNRATED_COLOR }} />
              {formatWeekday(day).slice(0, 2)}
            </span>
          );
        })}
      </div>
      <div className="row between" style={{ marginTop: 14 }}>
        <span className="t-small">
          {days.filter((x) => byDate.has(x)).length} check-ins, {t.sessions} {t.sessions === 1 ? 'session' : 'sessions'}
          {sleep.avg !== null ? `, ${sleep.avg.toFixed(1)}h sleep` : ''}
        </span>
        <ChevronRight size={18} color="var(--text-3)" />
      </div>
    </Panel>
  );
}

/* ── Muscles preview ─────────────────────────────────────── */

export function MusclesWidget({ d }: { d: HomeData }) {
  const range = { start: maxDate(addDays(d.today, -29), d.lockIn.startDate), end: d.today };
  const vol = useMemo(() => muscleVolume(d.training, range), [d.training, range.start, range.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasData = Object.values(vol).some((v) => v.sets > 0);
  return (
    <Panel eyebrow="Muscle map" action={<span className="t-eyebrow">Last 30 days</span>} onPress={() => go('progress', 'muscles')}>
      <div className="row gap-4">
        <div className="row" style={{ gap: 2, flex: 'none' }}>
          <BodyMap2D volume={vol} side="front" height={120} />
          <BodyMap2D volume={vol} side="back" height={120} />
        </div>
        <div className="stack gap-2 grow">
          <span className="t-h3" style={{ fontSize: 15 }}>
            {hasData ? 'Where your sets went' : 'No detailed workouts yet'}
          </span>
          <span className="t-small">{hasData ? 'Brightness shows recorded training volume per muscle group.' : 'Log exercises and sets to light up the map.'}</span>
          <span className="t-small" style={{ color: 'var(--mint)', fontWeight: 650 }}>
            Open the 3D map
          </span>
        </div>
      </div>
    </Panel>
  );
}

/* ── Journal prompt ──────────────────────────────────────── */

export function JournalWidget({ d }: { d: HomeData }) {
  return (
    <Panel eyebrow="Journal" onPress={() => go('progress', 'journalEntry', { date: d.today })}>
      <div className="row gap-3">
        <div className="stack grow">
          <span className="t-h3" style={{ fontSize: 15 }}>
            {d.journalToday ? 'You reflected today' : 'A minute to reflect?'}
          </span>
          <span className="t-small">{d.journalToday ? 'Tap to read or add to it.' : 'Energy, motivation, how training felt. Private to you.'}</span>
        </div>
        <ChevronRight size={18} color="var(--text-3)" />
      </div>
    </Panel>
  );
}

export const WIDGET_META = {
  checkin: { label: "Today's check-in", icon: CalendarCheck },
  stats: { label: 'Statistics', icon: ChartColumn },
  pulse: { label: 'Lock In Pulse', icon: Sparkles },
  habits: { label: 'Habits', icon: ListChecks },
  goals: { label: 'Mini goals', icon: Target },
  milestones: { label: 'Milestones', icon: Trophy },
  review: { label: 'Weekly review', icon: ChartColumn },
  muscles: { label: 'Muscle map', icon: Dumbbell },
  journal: { label: 'Journal', icon: PenLine },
} as const;
