import { AnimatePresence, motion } from 'motion/react';
import { BedDouble, ChevronLeft, ChevronRight, Dumbbell, ListChecks, PenLine, Pill, Plus, Utensils } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Block, Page } from '@/components/Page';
import { Badge, Button, IconButton, Panel, cx } from '@/design/primitives';
import { useCheckIns, useJournal, useTraining } from '@/data/hooks';
import { useSettings } from '@/data/settings';
import type { CheckIn, ISODate } from '@/data/types';
import { addDays, addMonths, daysInMonth, diffDays, formatDate, startOfMonth, todayISO, weekday } from '@/domain/dates';
import { ratingDistribution, sleepStats, trainingSummary, type RatingBucket } from '@/domain/analytics';
import { useToday } from '@/hooks/useNow';
import { useActive } from '@/state/lockin';
import { useUI } from '@/state/ui';
import { go } from '@/nav/store';
import { FOOD_LABEL, RATINGS, RATING_COLOR, RATING_LABEL, TRAINING_LABEL, fmtHours } from '@/components/ratings';
import './calendar.css';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarPage() {
  const lockIn = useActive();
  const today = useToday();
  const checkIns = useCheckIns(lockIn.id);
  const training = useTraining(lockIn.id);
  const journal = useJournal(lockIn.id);
  const settings = useSettings();
  const openSheet = useUI((s) => s.openSheet);

  const initialMonth = startOfMonth(today < lockIn.startDate ? lockIn.startDate : today > lockIn.targetDate ? lockIn.targetDate : today);
  const [month, setMonth] = useState(initialMonth);
  const [dir, setDir] = useState(0);
  const [selected, setSelected] = useState<ISODate>(today >= lockIn.startDate && today <= lockIn.targetDate ? today : lockIn.startDate);

  const byDate = useMemo(() => new Map(checkIns.map((c) => [c.date, c])), [checkIns]);
  const workoutDates = useMemo(() => new Set([...training.map((w) => w.date), ...checkIns.filter((c) => c.training === 'workout').map((c) => c.date)]), [training, checkIns]);
  const journalDates = useMemo(() => new Set(journal.map((j) => j.date)), [journal]);

  const minMonth = startOfMonth(lockIn.startDate);
  const maxMonth = startOfMonth(lockIn.targetDate > today ? lockIn.targetDate : today);
  const canPrev = month > minMonth;
  const canNext = month < maxMonth;
  const shift = (d: 1 | -1) => {
    if ((d === -1 && !canPrev) || (d === 1 && !canNext)) return;
    setDir(d);
    setMonth(addMonths(month, d));
  };

  const cells = useMemo(() => {
    const lead = weekday(month);
    const n = daysInMonth(month);
    return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => addDays(month, i))] as (ISODate | null)[];
  }, [month]);

  const monthEnd = addDays(month, daysInMonth(month) - 1);
  const monthDays = cells.filter((c): c is ISODate => !!c && c >= lockIn.startDate && c <= lockIn.targetDate && c <= today);
  const dist = ratingDistribution(checkIns, monthDays);
  const monthRange = { start: month, end: monthEnd };
  const mSleep = sleepStats(checkIns, monthRange);
  const mTrain = trainingSummary(checkIns, training, monthRange);
  const rated = checkIns.filter((c) => c.rating).length;

  return (
    <Page title="Calendar" subtitle={checkIns.length ? `${rated} of ${checkIns.length} check-ins have a colour.` : 'Every day you check in gets the colour you choose.'}>
      <Block>
        <Panel>
          <div className="cal-head">
            <div className="stack">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.div
                  key={month}
                  className="cal-month"
                  custom={dir}
                  initial={{ opacity: 0, y: dir * 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: dir * -12 }}
                  transition={{ duration: 0.3 }}
                >
                  {formatDate(month, { month: 'long' })}
                </motion.div>
              </AnimatePresence>
              <span className="cal-year">{month.slice(0, 4)}</span>
            </div>
            <div className="row gap-2">
              <IconButton label="Previous month" size="sm" onClick={() => shift(-1)} disabled={!canPrev} style={{ opacity: canPrev ? 1 : 0.3 }}>
                <ChevronLeft />
              </IconButton>
              <IconButton label="Next month" size="sm" onClick={() => shift(1)} disabled={!canNext} style={{ opacity: canNext ? 1 : 0.3 }}>
                <ChevronRight />
              </IconButton>
            </div>
          </div>

          <div className="cal-weekdays" aria-hidden>
            {WEEKDAYS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="cal-viewport">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={month}
                className="cal-grid"
                role="grid"
                aria-label={formatDate(month, { month: 'long', year: 'numeric' })}
                custom={dir}
                initial={{ x: dir * 80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: dir * -80, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, i) => {
                  if (i.offset.x < -50) shift(1);
                  else if (i.offset.x > 50) shift(-1);
                }}
              >
                {cells.map((date, i) => {
                  if (!date) return <span key={`b${i}`} />;
                  const c = byDate.get(date);
                  const inLock = date >= lockIn.startDate && date <= lockIn.targetDate;
                  const future = date > today;
                  const isSel = date === selected;
                  const color = c?.rating ? RATING_COLOR[c.rating] : undefined;
                  return (
                    <motion.button
                      key={date}
                      type="button"
                      role="gridcell"
                      aria-selected={isSel}
                      aria-label={`${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}${c?.rating ? `, ${RATING_LABEL[c.rating]}` : c ? ', checked in' : ''}`}
                      className={cx(
                        'cal-cell',
                        inLock && !future && 'cal-cell--in',
                        inLock && future && 'cal-cell--future',
                        !inLock && 'cal-cell--out',
                        c?.rating && 'cal-cell--rated',
                        date === today && 'cal-cell--today',
                      )}
                      onClick={() => setSelected(date)}
                      whileTap={{ scale: 0.9 }}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: isSel ? 1.06 : 1 }}
                      transition={{ opacity: { delay: Math.min(i * 0.012, 0.4) }, scale: { type: 'spring', stiffness: 500, damping: 26 } }}
                    >
                      <span className="cal-cell__fill" style={color ? { backgroundColor: color } : undefined} />
                      {date.slice(8).replace(/^0/, '')}
                      {(workoutDates.has(date) || journalDates.has(date) || c?.note) && (
                        <span className="cal-cell__dots" aria-hidden>
                          {workoutDates.has(date) && <i />}
                          {(journalDates.has(date) || c?.note) && <i className="is-note" style={{ color: c?.rating ? 'rgba(3,19,10,.65)' : 'var(--mint)' }} />}
                        </span>
                      )}
                      {isSel && <motion.span layoutId="cal-sel" className="cal-sel" transition={{ type: 'spring', stiffness: 520, damping: 34 }} />}
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="divider" />
          <div className="legend" style={{ justifyContent: 'space-between' }}>
            {RATINGS.map((r) => (
              <span key={r.value}>
                <i style={{ background: r.color }} />
                {r.label}
              </span>
            ))}
            <span>
              <i style={{ background: 'var(--rate-none)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)' }} />
              Unrated
            </span>
          </div>
        </Panel>
      </Block>

      <Block>
        <DayDetail
          date={selected}
          checkIn={byDate.get(selected)}
          hasWorkoutLog={training.some((w) => w.date === selected)}
          hasJournal={journalDates.has(selected)}
          inLock={selected >= lockIn.startDate && selected <= lockIn.targetDate}
          future={selected > today}
          habitsTotal={lockIn.habits.length}
          habitLabels={lockIn.habits}
          showSupps={settings?.showSupplements ?? false}
          onCheckIn={() => openSheet({ type: 'checkin', date: selected })}
          onWorkout={() => {
            const w = training.find((x) => x.date === selected);
            openSheet({ type: 'workout', id: w?.id, date: selected });
          }}
        />
      </Block>

      <Block>
        <Panel eyebrow="Month overview" action={<span className="t-eyebrow">{formatDate(month, { month: 'short', year: 'numeric' })}</span>}>
          {monthDays.length === 0 ? (
            <p className="t-small">No Lock In days in this month yet.</p>
          ) : (
            <>
              <div className="distribution" role="img" aria-label="Rating distribution for the month">
                {(['great', 'good', 'okay', 'tough', 'unrated'] as RatingBucket[]).map((k, i) =>
                  dist[k] ? (
                    <motion.span
                      key={k}
                      style={{ flex: dist[k], background: k === 'unrated' ? 'var(--rate-none)' : RATING_COLOR[k] }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.1 + i * 0.08, duration: 0.6 }}
                    />
                  ) : null,
                )}
              </div>
              <div className="grid-3" style={{ marginTop: 18 }}>
                <div className="kv">
                  <span className="kv__value">
                    {dist.great + dist.good}
                    <small>/{monthDays.length}</small>
                  </span>
                  <span className="kv__label">Green days</span>
                </div>
                <div className="kv">
                  <span className="kv__value">{mTrain.sessions}</span>
                  <span className="kv__label">Workouts</span>
                </div>
                <div className="kv">
                  <span className="kv__value">
                    {mSleep.avg === null ? '—' : mSleep.avg.toFixed(1)}
                    {mSleep.avg !== null && <small>h</small>}
                  </span>
                  <span className="kv__label">Avg sleep · {mSleep.nights}n</span>
                </div>
              </div>
            </>
          )}
        </Panel>
      </Block>
    </Page>
  );
}

function DayDetail(props: {
  date: ISODate;
  checkIn: CheckIn | undefined;
  hasWorkoutLog: boolean;
  hasJournal: boolean;
  inLock: boolean;
  future: boolean;
  habitsTotal: number;
  habitLabels: { id: string; label: string }[];
  showSupps: boolean;
  onCheckIn: () => void;
  onWorkout: () => void;
}) {
  const { date, checkIn: c, inLock, future } = props;
  const editable = inLock && !future;
  const ago = diffDays(date, todayISO());
  return (
    <AnimatePresence mode="wait">
      <motion.div key={date} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
        <Panel
          glow={!!c?.rating}
          eyebrow={formatDate(date, { weekday: 'long' })}
          title={formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}
          action={c?.rating ? <Badge tone="solid">{RATING_LABEL[c.rating]}</Badge> : c ? <Badge tone="muted">Unrated</Badge> : undefined}
        >
          {!inLock ? (
            <p className="t-small">Outside this Lock In's window.</p>
          ) : future ? (
            <p className="t-small">This day hasn't happened yet.</p>
          ) : !c ? (
            <div className="stack gap-3">
              <p className="t-small">{ago > 0 ? 'No check-in recorded for this day. You can still add one. Late is fine.' : 'No check-in yet today.'}</p>
              <Button icon={<Plus />} onClick={props.onCheckIn}>
                Check in for this day
              </Button>
            </div>
          ) : (
            <div className="stack gap-3">
              <div className="day-detail__grid">
                <div className="day-fact">
                  <span className="day-fact__label">
                    <BedDouble /> Sleep
                  </span>
                  <div className="day-fact__value">{c.sleepHours === null ? 'Not recorded' : fmtHours(c.sleepHours, 2)}</div>
                </div>
                <div className="day-fact">
                  <span className="day-fact__label">
                    <Dumbbell /> Training
                  </span>
                  <div className="day-fact__value">{c.training ? TRAINING_LABEL[c.training].replace('Completed workout', 'Workout') : 'Not recorded'}</div>
                </div>
                <div className="day-fact">
                  <span className="day-fact__label">
                    <Utensils /> Food
                  </span>
                  <div className="day-fact__value">{c.food ? FOOD_LABEL[c.food] : 'Not recorded'}</div>
                </div>
                <div className="day-fact">
                  <span className="day-fact__label">
                    <ListChecks /> Habits
                  </span>
                  <div className="day-fact__value">{props.habitsTotal ? `${props.habitLabels.filter((h) => c.habits?.[h.id]).length} of ${props.habitsTotal}` : 'None set'}</div>
                </div>
                {props.showSupps && (c.creatine !== null || c.protein !== null) && (
                  <div className="day-fact" style={{ gridColumn: '1 / -1' }}>
                    <span className="day-fact__label">
                      <Pill /> Supplements (personal log)
                    </span>
                    <div className="day-fact__value" style={{ fontSize: 13 }}>
                      Creatine: {c.creatine === null ? '—' : c.creatine ? 'Yes' : 'No'} · Protein: {c.protein === null ? '—' : c.protein ? 'Yes' : 'No'}
                    </div>
                  </div>
                )}
              </div>
              {c.note && <div className="day-note">{c.note}</div>}
              <div className="grid-2" style={{ marginTop: 4 }}>
                <Button variant="secondary" size="sm" onClick={props.onCheckIn}>
                  Edit check-in
                </Button>
                <Button variant="secondary" size="sm" icon={<Dumbbell />} onClick={props.onWorkout}>
                  {props.hasWorkoutLog ? 'View workout' : 'Log workout'}
                </Button>
              </div>
            </div>
          )}
          {editable && (
            <button className="row gap-2 t-small" style={{ marginTop: 14, color: 'var(--mint)', fontWeight: 650 }} onClick={() => go('progress', 'journalEntry', { date })}>
              <PenLine size={15} /> {props.hasJournal ? 'Open journal entry' : 'Write a journal entry for this day'}
            </button>
          )}
        </Panel>
      </motion.div>
    </AnimatePresence>
  );
}

