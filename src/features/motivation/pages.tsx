import { motion } from 'motion/react';
import { Archive, ArchiveRestore, Bot, Check, ChevronLeft, ChevronRight, Minus, PenLine, Pencil, Plus, Search, Target, Trash } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Block, Page } from '@/components/Page';
import { Badge, Button, Chip, DatePicker, Delta, EmptyState, Field, IconButton, Panel } from '@/design/primitives';
import { AnimatedNumber, ProgressRing } from '@/design/visuals';
import { confirmAction } from '@/design/Overlays';
import { Emblem } from '@/components/Emblem';
import { HABIT_ICONS } from '@/components/icons';
import { FOOD_LEVELS, RATING_COLOR, RATING_LABEL, UNRATED_COLOR } from '@/components/ratings';
import { useCheckIns, useGoals, useJournal, useMeasurements, useMilestoneRecords, usePhotos, useTraining } from '@/data/hooks';
import { useCoachSettings } from '@/data/settings';
import { db } from '@/data/db';
import { bumpManualGoal, deleteJournal, markReviewViewed, saveJournal, setGoalStatus } from '@/data/repo';
import type { ISODate, JournalEntry, LockIn, MiniGoal, Scale5 } from '@/data/types';
import { MUSCLE_BY_ID } from '@/data/training/muscles';
import type { TrainingRecord } from '@/data/training/source';
import { addDays, diffDays, eachDay, formatDate, formatRange, formatShort, formatWeekday, isoFromMs, startOfWeek, todayISO } from '@/domain/dates';
import { MILESTONES, MILESTONE_BY_KEY } from '@/domain/milestones';
import { goalProgress, GOAL_METRIC_LABELS } from '@/domain/goals';
import { buildWeeklyReview, lockInWeeks, type WeeklyReview } from '@/domain/weekly';
import { trainingSummary, type RatingBucket } from '@/domain/analytics';
import { useToday } from '@/hooks/useNow';
import { useActive } from '@/state/lockin';
import { toast, useUI } from '@/state/ui';
import { goBack, useNav } from '@/nav/store';
import './motivation.css';

/* ═══════════════════════ Milestones ═══════════════════════ */

export function MilestonesPage() {
  const lockIn = useActive();
  const records = useMilestoneRecords(lockIn.id);
  const checkIns = useCheckIns(lockIn.id);
  const training = useTraining(lockIn.id);
  const enqueue = useUI((s) => s.enqueueCelebrations);
  const earned = new Map(records.map((r) => [r.key, r]));
  const t = trainingSummary(checkIns, training, { start: '0000-01-01', end: '9999-12-31' });
  const progressHint: Record<string, string> = {
    'checkins-7': `${Math.min(7, checkIns.length)}/7`,
    'checkins-30': `${Math.min(30, checkIns.length)}/30`,
    'checkins-60': `${Math.min(60, checkIns.length)}/60`,
    'checkins-100': `${Math.min(100, checkIns.length)}/100`,
    'workouts-10': `${Math.min(10, t.sessions)}/10`,
    'workouts-25': `${Math.min(25, t.sessions)}/25`,
    'workouts-50': `${Math.min(50, t.sessions)}/50`,
    'rest-5': `${Math.min(5, t.restDays)}/5`,
    'sleep-7': `${Math.min(7, checkIns.filter((c) => (c.sleepHours ?? 0) >= 7).length)}/7`,
  };
  return (
    <Page title="Milestones" eyebrow={`${records.length} of ${MILESTONES.length} earned`} backLabel="Back" subtitle="Earned only from things you actually recorded. Tap an earned milestone to relive it.">
      <Block>
        <Panel glow>
          <div className="row gap-4">
            <ProgressRing value={records.length / MILESTONES.length} size={70} stroke={5}>
              <span className="t-mono" style={{ fontSize: 13 }}>
                {records.length}
              </span>
            </ProgressRing>
            <div className="stack">
              <span className="t-h3">{records.length ? MILESTONE_BY_KEY[[...records].sort((a, b) => b.achievedAt - a.achievedAt)[0].key]?.title : 'No milestones yet'}</span>
              <span className="t-small">{records.length ? 'Most recent' : 'Your first check-in unlocks one.'}</span>
            </div>
          </div>
        </Panel>
      </Block>
      <Block>
        <div className="ms-grid">
          {MILESTONES.map((m, i) => {
            const r = earned.get(m.key);
            return (
              <motion.button
                key={m.key}
                className={`ms-cell ${r ? 'ms-cell--earned' : ''}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                whileTap={r ? { scale: 0.95 } : undefined}
                onClick={() => r && enqueue([m.key])}
                aria-label={`${m.title}${r ? ', earned' : ', locked'}`}
              >
                <Emblem milestoneKey={m.key} size={56} locked={!r} />
                <span className="ms-cell__title" style={{ color: r ? undefined : 'var(--text-3)' }}>
                  {m.title}
                </span>
                <span className="ms-cell__sub">{r ? formatDate(isoFromMs(r.achievedAt), { day: 'numeric', month: 'short' }) : (progressHint[m.key] ?? m.description)}</span>
              </motion.button>
            );
          })}
        </div>
      </Block>
    </Page>
  );
}


/* ═══════════════════════ Mini goals ═══════════════════════ */

function GoalCard({ goal, lockIn, records, checkIns }: { goal: MiniGoal; lockIn: LockIn; records: TrainingRecord[]; checkIns: ReturnType<typeof useCheckIns> }) {
  const openSheet = useUI((s) => s.openSheet);
  const today = useToday();
  const p = goalProgress(goal, checkIns, records);
  const ended = goal.endDate < today;
  const daysLeft = diffDays(today, goal.endDate);
  const habit = goal.habitId ? lockIn.habits.find((h) => h.id === goal.habitId) : undefined;
  return (
    <Panel glow={goal.status === 'completed'}>
      <div className="goal-card__top">
        <ProgressRing value={p.pct} size={58} stroke={5}>
          {p.reached ? <Check size={20} color="var(--mint)" /> : <span className="t-mono" style={{ fontSize: 12 }}>{Math.round(p.pct * 100)}%</span>}
        </ProgressRing>
        <div className="stack grow" style={{ minWidth: 0 }}>
          <span className="t-h3" style={{ fontSize: 15 }}>
            {goal.title}
          </span>
          <span className="t-small" style={{ fontSize: 12 }}>
            {p.current} of {p.target} · {GOAL_METRIC_LABELS[goal.metric]}
            {habit ? ` (${habit.label})` : goal.metric === 'sleepNights' ? ` (${goal.sleepThreshold}h+)` : ''}
          </span>
          <span className="t-small" style={{ fontSize: 11.5 }}>
            {formatShort(goal.startDate)} - {formatShort(goal.endDate)}
            {goal.status === 'active' && !ended && ` · ${daysLeft === 0 ? 'last day' : `${daysLeft} days left`}`}
          </span>
        </div>
        {goal.status === 'completed' && <Badge>Done</Badge>}
      </div>
      {goal.status === 'active' && ended && !p.reached && (
        <p className="t-small" style={{ marginTop: 12, fontSize: 12.5 }}>
          Period ended at {p.current} of {p.target}. That's still {p.current}. Archive it, or edit the dates to keep going.
        </p>
      )}
      <div className="goal-actions">
        {goal.status === 'active' && goal.metric === 'manual' && (
          <>
            <IconButton label="Decrease progress" size="sm" onClick={() => bumpManualGoal(goal.id, -1)}>
              <Minus />
            </IconButton>
            <IconButton label="Increase progress" size="sm" variant="accent" onClick={() => bumpManualGoal(goal.id, 1)}>
              <Plus />
            </IconButton>
          </>
        )}
        {goal.status === 'active' && (
          <>
            <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => openSheet({ type: 'goal', id: goal.id })}>
              Edit
            </Button>
            <Button size="sm" variant="secondary" icon={<Check />} onClick={() => setGoalStatus(goal.id, 'completed')}>
              Complete
            </Button>
          </>
        )}
        {goal.status !== 'archived' ? (
          <Button size="sm" variant="ghost" icon={<Archive />} onClick={() => setGoalStatus(goal.id, 'archived')}>
            Archive
          </Button>
        ) : (
          <Button size="sm" variant="ghost" icon={<ArchiveRestore />} onClick={() => setGoalStatus(goal.id, goal.completedAt ? 'completed' : 'active')}>
            Restore
          </Button>
        )}
      </div>
    </Panel>
  );
}

export function GoalsPage() {
  const lockIn = useActive();
  const goals = useGoals(lockIn.id);
  const checkIns = useCheckIns(lockIn.id);
  const records = useTraining(lockIn.id);
  const openSheet = useUI((s) => s.openSheet);
  const [showArchived, setShowArchived] = useState(false);
  const active = goals.filter((g) => g.status === 'active');
  const done = goals.filter((g) => g.status === 'completed');
  const archived = goals.filter((g) => g.status === 'archived');

  return (
    <Page
      title="Mini goals"
      backLabel="Back"
      heroRight={
        <Button size="sm" icon={<Plus />} onClick={() => openSheet({ type: 'goal' })}>
          New
        </Button>
      }
    >
      {goals.length === 0 && (
        <Block>
          <Panel>
            <EmptyState
              icon={<Target />}
              title="No mini goals yet"
              text="Three workouts this week. Five check-ins. A consistent sleep schedule. Progress updates automatically from your records."
              action={
                <Button icon={<Plus />} onClick={() => openSheet({ type: 'goal' })}>
                  Create a goal
                </Button>
              }
            />
          </Panel>
        </Block>
      )}
      {active.length > 0 && <Block><div className="t-eyebrow section-label" style={{ marginTop: 0 }}>Active</div></Block>}
      {active.map((g) => (
        <Block key={g.id}>
          <GoalCard goal={g} lockIn={lockIn} records={records} checkIns={checkIns} />
        </Block>
      ))}
      {done.length > 0 && <Block><div className="t-eyebrow section-label">Completed</div></Block>}
      {done.map((g) => (
        <Block key={g.id}>
          <GoalCard goal={g} lockIn={lockIn} records={records} checkIns={checkIns} />
        </Block>
      ))}
      {archived.length > 0 && (
        <Block>
          <Button variant="ghost" block onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </Button>
        </Block>
      )}
      {showArchived &&
        archived.map((g) => (
          <Block key={g.id}>
            <GoalCard goal={g} lockIn={lockIn} records={records} checkIns={checkIns} />
          </Block>
        ))}
    </Page>
  );
}

/* ═══════════════════════ Journal ═══════════════════════ */

function Dots({ v }: { v: Scale5 | null }) {
  return (
    <span className="dots" aria-label={v ? `${v} of 5` : 'not set'}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} data-on={v !== null && i <= v} />
      ))}
    </span>
  );
}

export function JournalPage() {
  const lockIn = useActive();
  const entries = useJournal(lockIn.id);
  const push = useNav((s) => s.push);
  const [q, setQ] = useState('');
  const list = entries.filter((e) => !q.trim() || `${e.body} ${e.training}`.toLowerCase().includes(q.trim().toLowerCase()));
  const months = useMemo(() => {
    const m = new Map<string, JournalEntry[]>();
    for (const e of list) {
      const k = e.date.slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return [...m.entries()];
  }, [list]);

  return (
    <Page
      title="Journal"
      backLabel="Back"
      subtitle="Energy, motivation, training and recovery, in your own words."
      heroRight={
        <Button size="sm" icon={<PenLine />} onClick={() => push('journalEntry', { date: todayISO() })}>
          Write
        </Button>
      }
    >
      {entries.length === 0 ? (
        <Block>
          <Panel>
            <EmptyState
              icon={<PenLine />}
              title="A calm place to think"
              text="Write as much or as little as you like. Entries are linked to dates on your calendar and stay on this device."
              action={
                <Button icon={<PenLine />} onClick={() => push('journalEntry', { date: todayISO() })}>
                  Write today's entry
                </Button>
              }
            />
          </Panel>
        </Block>
      ) : (
        <>
          <Block>
            <div className="search">
              <Search />
              <input className="input" placeholder="Search your journal" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </Block>
          {months.map(([m, es]) => (
            <Block key={m}>
              <div className="t-eyebrow section-label" style={{ marginTop: 4 }}>
                {formatDate(`${m}-01`, { month: 'long', year: 'numeric' })}
              </div>
              <div className="stack gap-2">
                {es.map((e) => (
                  <Panel key={e.id} tight onPress={() => push('journalEntry', { id: e.id })}>
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{formatDate(e.date, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                      <span className="row gap-3 t-faint" style={{ fontSize: 10 }}>
                        <span className="row gap-1">E <Dots v={e.energy} /></span>
                        <span className="row gap-1">M <Dots v={e.motivation} /></span>
                      </span>
                    </div>
                    <p className="t-small" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {e.body || e.training || <em className="t-faint">No text</em>}
                    </p>
                  </Panel>
                ))}
              </div>
            </Block>
          ))}
        </>
      )}
    </Page>
  );
}

const PROMPTS = ['What went well today?', 'What felt hard?', 'How did my body feel in training?', 'What will I do tomorrow?'];

function Scale({ label, value, onChange }: { label: string; value: Scale5 | null; onChange: (v: Scale5 | null) => void }) {
  return (
    <Field label={label} hint={value ? `${value}/5` : 'Optional'}>
      <div className="scale5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} data-on={value !== null && i <= value} onClick={() => onChange(value === i ? null : (i as Scale5))}>
            {i}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function JournalEntryPage({ params }: { params: Record<string, string> }) {
  const lockIn = useActive();
  const existing = useLiveQuery(
    async () => (params.id ? ((await db.journal.get(params.id)) ?? null) : params.date ? ((await db.journal.where('lockInId').equals(lockIn.id).filter((j) => j.date === params.date).first()) ?? null) : null),
    [params.id, params.date, lockIn.id],
  );
  const [loaded, setLoaded] = useState(false);
  const [date, setDate] = useState<ISODate>(params.date ?? todayISO());
  const [energy, setEnergy] = useState<Scale5 | null>(null);
  const [motivation, setMotivation] = useState<Scale5 | null>(null);
  const [recovery, setRecovery] = useState<Scale5 | null>(null);
  const [training, setTraining] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing === undefined || loaded) return;
    if (existing) {
      setDate(existing.date);
      setEnergy(existing.energy);
      setMotivation(existing.motivation);
      setRecovery(existing.recovery);
      setTraining(existing.training);
      setBody(existing.body);
    }
    setLoaded(true);
  }, [existing, loaded]);

  const save = async () => {
    setSaving(true);
    await saveJournal({ id: existing?.id, lockInId: lockIn.id, date, energy, motivation, recovery, training: training.trim(), body: body.trim() });
    setSaving(false);
    toast('Journal saved', { tone: 'success' });
    goBack();
  };
  const remove = async () => {
    if (!existing || !(await confirmAction({ title: 'Delete this entry?', confirmLabel: 'Delete', tone: 'danger' }))) return;
    await deleteJournal(existing.id);
    goBack();
  };
  const empty = !body.trim() && !training.trim() && !energy && !motivation && !recovery;

  return (
    <Page title={existing ? 'Journal entry' : 'New entry'} eyebrow={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} backLabel="Back" actions={existing ? <IconButton label="Delete entry" size="sm" onClick={remove}><Trash /></IconButton> : undefined}>
      <Block>
        <Field label="Date">
          <DatePicker label="Entry date" value={date} onChange={setDate} min={lockIn.startDate} max={todayISO()} />
        </Field>
      </Block>
      <Block>
        <div className="stack gap-4">
          <Scale label="Energy" value={energy} onChange={setEnergy} />
          <Scale label="Motivation" value={motivation} onChange={setMotivation} />
          <Scale label="Recovery" value={recovery} onChange={setRecovery} />
        </div>
      </Block>
      <Block>
        <Field label="Training experience" hint="Optional">
          <textarea className="input" rows={2} maxLength={500} value={training} placeholder="How did training feel?" onChange={(e) => setTraining(e.target.value)} />
        </Field>
      </Block>
      <Block>
        <Field label="Reflection">
          <textarea className="input journal-text" maxLength={5000} value={body} placeholder="Write freely…" onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="row wrap gap-2" style={{ marginTop: 10 }}>
          {PROMPTS.map((p) => (
            <Chip key={p} selected={false} onClick={() => setBody((b) => `${b}${b && !b.endsWith('\n') ? '\n\n' : ''}${p}\n`)}>
              {p}
            </Chip>
          ))}
        </div>
      </Block>
      <Block>
        <Button block size="lg" loading={saving} disabled={empty} onClick={save}>
          Save entry
        </Button>
      </Block>
    </Page>
  );
}

/* ═══════════════════════ Weekly review ═══════════════════════ */

function useWeeklyInput(lockIn: LockIn) {
  const checkIns = useCheckIns(lockIn.id);
  const workouts = useTraining(lockIn.id);
  const milestones = useMilestoneRecords(lockIn.id);
  const measurements = useMeasurements(lockIn.id);
  const journal = useJournal(lockIn.id);
  const photos = usePhotos(lockIn.id) ?? [];
  return useMemo(() => ({ lockIn, checkIns, workouts, milestones, measurements, journal, photos }), [lockIn, checkIns, workouts, milestones, measurements, journal, photos]);
}

export function ReviewsList({ lockIn }: { lockIn: LockIn }) {
  const today = useToday();
  const input = useWeeklyInput(lockIn);
  const push = useNav((s) => s.push);
  const weeks = lockInWeeks(lockIn, lockIn.status === 'completed' ? lockIn.targetDate : today);
  const weekNo = (w: ISODate) => Math.floor(diffDays(startOfWeek(lockIn.startDate), w) / 7) + 1;
  return (
    <div className="list">
      {weeks.map((w) => {
        const r = buildWeeklyReview(input, w, lockIn.status === 'completed' ? addDays(lockIn.targetDate, 1) : today);
        return (
          <button key={w} className="list-row" onClick={() => push('review', { week: w, lockIn: lockIn.id })}>
            <span className="stack grow">
              <span className="list-row__title">
                Week {weekNo(w)} {!r.complete && <Badge tone="muted">In progress</Badge>}
              </span>
              <span className="list-row__sub">
                {formatRange(w, addDays(w, 6))} · {r.checkIns}/{r.days.length} check-ins · {r.training.sessions} sessions
              </span>
            </span>
            <span className="week-item__bar" aria-hidden>
              {eachDay(w, addDays(w, 6)).map((d) => {
                const c = input.checkIns.find((x) => x.date === d);
                return <i key={d} style={{ background: c?.rating ? RATING_COLOR[c.rating] : c ? 'rgba(160,245,184,.35)' : UNRATED_COLOR }} />;
              })}
            </span>
            <span className="list-row__chev">
              <ChevronRight />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ReviewsPage() {
  const lockIn = useActive();
  return (
    <Page title="Weekly reviews" backLabel="Back" subtitle="Every week of your Lock In, summarised from what you recorded.">
      <Block>
        <ReviewsList lockIn={lockIn} />
      </Block>
    </Page>
  );
}

function Row({ label, value, missing }: { label: string; value: React.ReactNode; missing?: string | false }) {
  return (
    <div className="rv-row">
      <span className="t-muted">{label}</span>
      {missing ? <span className="rv-missing">{missing}</span> : <b>{value}</b>}
    </div>
  );
}

export function ReviewPage({ params }: { params: Record<string, string> }) {
  const active = useActive();
  const other = useLiveQuery(() => (params.lockIn && params.lockIn !== active.id ? db.lockIns.get(params.lockIn) : undefined), [params.lockIn, active.id]);
  const lockIn = other ?? active;
  const today = useToday();
  const coach = useCoachSettings();
  const input = useWeeklyInput(lockIn);
  const replace = useNav((s) => s.replace);
  const push = useNav((s) => s.push);
  const week = params.week ?? startOfWeek(today);
  const asOf = lockIn.status === 'completed' ? addDays(lockIn.targetDate, 1) : today;
  const r: WeeklyReview = buildWeeklyReview(input, week, asOf);
  const weeks = lockInWeeks(lockIn, lockIn.status === 'completed' ? lockIn.targetDate : today);
  const idx = weeks.indexOf(week);
  const weekNo = Math.floor(diffDays(startOfWeek(lockIn.startDate), week) / 7) + 1;
  const p = r.previous;

  useEffect(() => {
    if (r.complete && lockIn.status === 'active') void markReviewViewed(lockIn.id);
  }, [r.complete, lockIn.id, lockIn.status]);

  const nav = (w: ISODate | undefined) => w && replace('review', { week: w, lockIn: lockIn.id });

  return (
    <Page
      title={`Week ${weekNo}`}
      eyebrow={r.complete ? 'Weekly review · complete' : 'Weekly review · in progress'}
      subtitle={formatRange(r.weekStart, r.weekEnd)}
      backLabel="Back"
      actions={
        <div className="row gap-2">
          <IconButton label="Previous week" size="sm" disabled={idx >= weeks.length - 1} onClick={() => nav(weeks[idx + 1])}>
            <ChevronLeft />
          </IconButton>
          <IconButton label="Next week" size="sm" disabled={idx <= 0} onClick={() => nav(weeks[idx - 1])}>
            <ChevronRight />
          </IconButton>
        </div>
      }
    >
      {r.days.length === 0 ? (
        <Block>
          <Panel>
            <p className="t-small">This week falls outside the Lock In.</p>
          </Panel>
        </Block>
      ) : (
        <>
          <Block>
            <Panel glow>
              <div className="rv-hero">
                <ProgressRing value={r.checkIns / r.days.length} size={104} stroke={7}>
                  <div className="stack" style={{ alignItems: 'center' }}>
                    <span className="t-num" style={{ fontSize: 26 }}>
                      <AnimatedNumber value={r.checkIns} />
                      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>/{r.days.length}</span>
                    </span>
                    <span className="t-eyebrow" style={{ fontSize: 8.5 }}>
                      check-ins
                    </span>
                  </div>
                </ProgressRing>
                <div className="stack gap-3">
                  <div className="kv">
                    <span className="kv__value">
                      <AnimatedNumber value={r.training.sessions} />
                      <small>sessions</small>
                    </span>
                    <span className="kv__label">
                      <Delta value={p ? r.training.sessions - p.sessions : null} digits={0} /> vs last week
                    </span>
                  </div>
                  <div className="kv">
                    <span className="kv__value">
                      {r.sleep.avg === null ? '—' : <AnimatedNumber value={r.sleep.avg} decimals={1} />}
                      {r.sleep.avg !== null && <small>h sleep</small>}
                    </span>
                    <span className="kv__label">{r.sleep.avg === null ? 'No nights recorded' : <><Delta value={p && p.sleepAvg !== null ? r.sleep.avg - p.sleepAvg : null} unit="h" neutral /> vs last week</>}</span>
                  </div>
                </div>
              </div>
            </Panel>
          </Block>

          <Block>
            <Panel eyebrow="Day colours">
              <div className="rv-days">
                {eachDay(r.weekStart, r.weekEnd).map((d, i) => {
                  const c = input.checkIns.find((x) => x.date === d);
                  const inWeek = r.days.includes(d);
                  return (
                    <div key={d} className="rv-day">
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: inWeek ? 1 : 0.25 }}
                        transition={{ delay: 0.2 + i * 0.06, type: 'spring', stiffness: 400, damping: 20 }}
                        style={{ background: c?.rating ? RATING_COLOR[c.rating] : UNRATED_COLOR, boxShadow: c?.rating ? `0 0 14px -4px ${RATING_COLOR[c.rating]}` : undefined }}
                      />
                      {formatWeekday(d).slice(0, 2)}
                    </div>
                  );
                })}
              </div>
              <div className="legend" style={{ marginTop: 14, justifyContent: 'space-between' }}>
                {(['great', 'good', 'okay', 'tough', 'unrated'] as RatingBucket[]).map((k) => (
                  <span key={k}>
                    <i style={{ background: k === 'unrated' ? UNRATED_COLOR : RATING_COLOR[k] }} />
                    {k === 'unrated' ? 'Unrated' : RATING_LABEL[k]} {r.ratings[k]}
                  </span>
                ))}
              </div>
            </Panel>
          </Block>

          <Block>
            <Panel eyebrow="Training">
              <Row label="Workouts completed" value={r.training.sessions} />
              <Row label="Planned rest days" value={r.training.restDays} />
              <Row label="Missed planned workouts" value={r.training.missed} />
              <Row label="Logged sets" value={r.sets} missing={r.training.logged === 0 && 'No detailed workouts logged'} />
              {p && <Row label="Sets vs last week" value={<Delta value={r.sets - p.sets} digits={0} neutral />} />}
            </Panel>
          </Block>

          {r.muscles.length > 0 && (
            <Block>
              <Panel eyebrow="Muscle groups">
                {r.muscles.slice(0, 6).map((m, i) => (
                  <div key={m.id} className="hbar">
                    <span className="hbar__label">{MUSCLE_BY_ID[m.id].label}</span>
                    <span className="hbar__track">
                      <motion.span
                        className="hbar__fill"
                        style={{ width: `${(m.sets / r.muscles[0].sets) * 100}%`, background: 'linear-gradient(90deg,#1a9e52,#a0f5b8)' }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.2 + i * 0.05, duration: 0.7 }}
                      />
                    </span>
                    <span className="hbar__value">{m.sets % 1 ? m.sets.toFixed(1) : m.sets}</span>
                  </div>
                ))}
              </Panel>
            </Block>
          )}

          <Block>
            <Panel eyebrow="Sleep">
              <Row label="Average" value={`${r.sleep.avg?.toFixed(1)}h`} missing={r.sleep.avg === null && 'No sleep recorded this week'} />
              <Row label="Nights recorded" value={`${r.sleep.nights} of ${r.days.length}`} />
              <Row label="Shortest · longest" value={`${r.sleep.min}h · ${r.sleep.max}h`} missing={r.sleep.min === null && '—'} />
            </Panel>
          </Block>

          {lockIn.habits.length > 0 && (
            <Block>
              <Panel eyebrow="Habits">
                {r.habits.map((h) => {
                  const Icon = HABIT_ICONS[h.habit.icon];
                  return (
                    <div key={h.habit.id} className="rv-row">
                      <span className="row gap-2 t-muted">
                        <Icon size={15} color="var(--mint)" /> {h.habit.label}
                      </span>
                      {h.recorded ? <b>{h.done}/{h.recorded}</b> : <span className="rv-missing">no check-ins</span>}
                    </div>
                  );
                })}
              </Panel>
            </Block>
          )}

          <Block>
            <Panel eyebrow="Food (self-assessed)">
              {r.food.recorded === 0 ? (
                <p className="rv-missing">No food assessments this week</p>
              ) : (
                FOOD_LEVELS.map((f) => (
                  <div key={f.value} className="rv-row">
                    <span className="t-muted">{f.label}</span>
                    <b>{r.food.counts[f.value]}</b>
                  </div>
                ))
              )}
            </Panel>
          </Block>

          <Block>
            <Panel eyebrow="Milestones & records">
              {r.milestones.length > 0 ? (
                <div className="row wrap gap-3" style={{ marginBottom: 12 }}>
                  {r.milestones.map((m) => (
                    <div key={m.id} className="stack" style={{ alignItems: 'center', width: 72, gap: 6 }}>
                      <Emblem milestoneKey={m.key} size={48} />
                      <span style={{ fontSize: 10.5, fontWeight: 650, textAlign: 'center' }}>{MILESTONE_BY_KEY[m.key]?.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rv-missing" style={{ marginBottom: 8 }}>
                  No new milestones this week
                </p>
              )}
              <Row label="Measurements recorded" value={r.measurements} />
              <Row label="Journal entries" value={r.journal} />
              <Row label="Progress photos" value={r.photos} />
            </Panel>
          </Block>

          {p && (
            <Block>
              <Panel eyebrow="Compared with last week">
                <Row label="Check-ins" value={<span className="row gap-2">{p.checkIns}/{p.eligibleDays} → {r.checkIns}/{r.days.length}</span>} />
                <Row label="Sessions" value={<span className="row gap-2">{p.sessions} → {r.training.sessions}</span>} />
                <Row label="Average sleep" value={p.sleepAvg === null || r.sleep.avg === null ? '—' : `${p.sleepAvg.toFixed(1)}h → ${r.sleep.avg.toFixed(1)}h`} />
              </Panel>
            </Block>
          )}

          {coach?.provider && lockIn.status === 'active' && (
            <Block>
              <Button variant="secondary" block icon={<Bot />} onClick={() => push('coachWeekly', { week })}>
                Ask TGLI Coach about this week
              </Button>
            </Block>
          )}
          <Block>
            <p className="t-small" style={{ fontSize: 12, textAlign: 'center' }}>
              Calculated on this device from your records. A dash or a note in italics means nothing was recorded, not zero.
            </p>
          </Block>
        </>
      )}
    </Page>
  );
}

