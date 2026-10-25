import { AnimatePresence, motion } from 'motion/react';
import { CircleDashed, Dumbbell, Leaf, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet } from '@/design/Sheet';
import { Button, Chip, cx } from '@/design/primitives';
import { RulerPicker } from '@/design/RulerPicker';
import { confirmAction } from '@/design/Overlays';
import { db } from '@/data/db';
import { deleteCheckIn, saveCheckIn, syncGoalCompletion, type CheckInDraft } from '@/data/repo';
import { useSettings } from '@/data/settings';
import type { CheckIn, DayRating, FoodLevel, LockIn, TrainingStatus } from '@/data/types';
import { diffDays, relativeDay, todayISO } from '@/domain/dates';
import { HABIT_ICONS } from '@/components/icons';
import { FOOD_LEVELS, RATINGS } from '@/components/ratings';
import { toast, useUI } from '@/state/ui';
import { vibrate } from '@/services/platform';
import './checkin.css';

const EMPTY: CheckInDraft = { sleepHours: null, training: null, food: null, creatine: null, protein: null, habits: {}, rating: null, note: '' };

const TRAINING_OPTS: { value: TrainingStatus; label: string; sub: string; icon: React.ReactNode }[] = [
  { value: 'workout', label: 'Workout', sub: 'Completed', icon: <Dumbbell /> },
  { value: 'rest', label: 'Rest day', sub: 'Planned', icon: <Leaf /> },
  { value: 'missed', label: 'Missed', sub: 'Planned workout', icon: <CircleDashed /> },
];

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ci-section">
      <div className="ci-section__head">
        <div className="ci-section__title">
          <span className="t-h3" style={{ fontSize: 15 }}>
            {title}
          </span>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function CheckInSheet({ lockIn }: { lockIn: LockIn }) {
  const sheet = useUI((s) => s.sheet);
  const closeSheet = useUI((s) => s.closeSheet);
  const openSheet = useUI((s) => s.openSheet);
  const settings = useSettings();
  const open = sheet?.type === 'checkin';
  const date = sheet?.type === 'checkin' ? sheet.date : todayISO();

  const [existing, setExisting] = useState<CheckIn | null>(null);
  const [draft, setDraft] = useState<CheckInDraft>(EMPTY);
  const [lastSleep, setLastSleep] = useState(7.5);
  const [logNext, setLogNext] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const [row, recent] = await Promise.all([
        db.checkIns.where('[lockInId+date]').equals([lockIn.id, date]).first(),
        db.checkIns.where('lockInId').equals(lockIn.id).filter((c) => c.sleepHours !== null && c.date < date).reverse().sortBy('date'),
      ]);
      if (!alive) return;
      setExisting(row ?? null);
      setDraft(row ? { sleepHours: row.sleepHours, training: row.training, food: row.food, creatine: row.creatine, protein: row.protein, habits: { ...row.habits }, rating: row.rating, note: row.note } : EMPTY);
      setLastSleep(recent[0]?.sleepHours ?? 7.5);
      setLogNext(false);
      setSaving(false);
    })();
    return () => {
      alive = false;
    };
  }, [open, date, lockIn.id]);

  const set = (p: Partial<CheckInDraft>) => setDraft((d) => ({ ...d, ...p }));
  const outOfRange = date < lockIn.startDate || date > lockIn.targetDate;
  const future = diffDays(todayISO(), date) > 0;

  const save = async () => {
    setSaving(true);
    try {
      await saveCheckIn(lockIn.id, date, draft);
      vibrate([10, 30, 20]);
      const goals = await syncGoalCompletion(lockIn.id);
      closeSheet();
      toast(existing ? 'Check-in updated' : `Checked in · ${relativeDay(date)}`, { tone: 'success' });
      if (goals.length) setTimeout(() => toast(`Mini goal reached: ${goals[0].title}`, { tone: 'success' }), 2900);
      if (logNext && draft.training === 'workout') setTimeout(() => openSheet({ type: 'workout', date }), 380);
    } catch (e) {
      console.error(e);
      toast('Could not save your check-in. Please try again.', { tone: 'error' });
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAction({ title: 'Delete this check-in?', message: 'The day returns to gray on your calendar. Milestones you earned stay.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    await deleteCheckIn(existing.id);
    closeSheet();
    toast('Check-in deleted');
  };

  const showSupps = settings?.showSupplements ?? false;

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      locked={saving}
      full
      eyebrow={relativeDay(date)}
      title={existing ? 'Edit check-in' : 'Daily check-in'}
      footer={
        <div className="row gap-2">
          {existing && (
            <Button variant="danger" onClick={remove} icon={<Trash />} aria-label="Delete check-in" style={{ width: 56, padding: 0 }} />
          )}
          <Button block size="lg" onClick={save} loading={saving} disabled={outOfRange || future}>
            {outOfRange ? 'Outside this Lock In' : future ? 'Future date' : existing ? 'Update check-in' : 'Save check-in'}
          </Button>
        </div>
      }
    >
      <Section title="Sleep"
        aside={
          draft.sleepHours === null ? (
            <Chip selected={false} onClick={() => set({ sleepHours: lastSleep })}>
              Use {lastSleep}h
            </Chip>
          ) : (
            <button className="t-eyebrow" style={{ color: 'var(--text-3)' }} onClick={() => set({ sleepHours: null })}>
              Clear
            </button>
          )
        }
      >
        <div className={cx('sleep-readout', draft.sleepHours === null && 'is-unset')}>
          <span className="sleep-readout__num">{String(draft.sleepHours ?? lastSleep)}</span>
          <span className="sleep-readout__unit">{draft.sleepHours === null ? 'slide to set' : 'hours'}</span>
        </div>
        <RulerPicker label="Hours slept" value={draft.sleepHours ?? lastSleep} min={0} max={14} step={0.25} onChange={(v) => set({ sleepHours: v })} format={(v) => `${v} hours`} />
      </Section>

      <Section title="Training">
        <div className="tiles">
          {TRAINING_OPTS.map((o) => (
            <motion.button key={o.value} type="button" className="tile" aria-pressed={draft.training === o.value} onClick={() => set({ training: draft.training === o.value ? null : o.value })} whileTap={{ scale: 0.95 }}>
              {o.icon}
              <span>{o.label}</span>
              <small>{o.sub}</small>
            </motion.button>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {draft.training === 'workout' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
              <div className="row between" style={{ paddingTop: 12 }}>
                <span className="t-small">Log exercises & sets after saving</span>
                <Chip selected={logNext} onClick={() => setLogNext(!logNext)}>
                  {logNext ? 'Yes' : 'No'}
                </Chip>
              </div>
            </motion.div>
          )}
          {draft.training === 'rest' && (
            <motion.p className="t-small" style={{ paddingTop: 10 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Planned rest is part of training. It counts toward your Lock In.
            </motion.p>
          )}
        </AnimatePresence>
      </Section>

      <Section title="Food" aside={<span className="t-eyebrow">Self-assessed</span>}>
        <div className="food">
          {FOOD_LEVELS.map((f) => (
            <motion.button key={f.value} type="button" className="food__opt" aria-pressed={draft.food === f.value} title={f.desc} onClick={() => set({ food: draft.food === f.value ? null : (f.value as FoodLevel) })} whileTap={{ scale: 0.95 }}>
              <span className="food__bars" aria-hidden>
                {[1, 2, 3, 4].map((b) => (
                  <i key={b} style={{ height: 6 + b * 4 }} data-on={b <= f.value} />
                ))}
              </span>
              {f.label}
            </motion.button>
          ))}
        </div>
      </Section>

      {showSupps && (
        <Section title="Supplements" aside={<span className="t-eyebrow">Personal log</span>}>
          {(['creatine', 'protein'] as const).map((k) => (
            <div className="yn" key={k}>
              <span style={{ fontWeight: 650, fontSize: 14 }}>{k === 'creatine' ? 'Creatine' : 'Protein supplement'}</span>
              <div className="yn__opts">
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" aria-pressed={draft[k] === v} onClick={() => set({ [k]: draft[k] === v ? null : v })}>
                    {v ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {lockIn.habits.length > 0 && (
        <Section title="Habits" aside={<span className="t-eyebrow">{lockIn.habits.filter((h) => draft.habits[h.id]).length}/{lockIn.habits.length}</span>}>
          <div className="row wrap gap-2">
            {lockIn.habits.map((h) => {
              const Icon = HABIT_ICONS[h.icon];
              return (
                <Chip key={h.id} selected={!!draft.habits[h.id]} onClick={() => set({ habits: { ...draft.habits, [h.id]: !draft.habits[h.id] } })} icon={<Icon />}>
                  {h.label}
                </Chip>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Rate your day" aside={<span className="t-eyebrow">Your call</span>}>
        <div className="ratings" role="radiogroup" aria-label="Day rating">
          {RATINGS.map((r) => {
            const sel = draft.rating === r.value;
            return (
              <motion.button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={sel}
                aria-pressed={sel}
                className="rating"
                onClick={() => {
                  vibrate(8);
                  set({ rating: sel ? null : (r.value as DayRating) });
                }}
                whileTap={{ scale: 0.92 }}
                style={{ color: sel ? r.color : undefined }}
              >
                <motion.span
                  className="rating__orb"
                  style={{ background: r.color }}
                  animate={{ scale: sel ? 1.08 : draft.rating ? 0.86 : 1, opacity: draft.rating && !sel ? 0.45 : 1, boxShadow: sel ? `0 0 26px ${r.color}, inset 0 -6px 12px rgba(0,0,0,.25)` : 'inset 0 -6px 12px rgba(0,0,0,.25)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                >
                  {sel && <motion.span className="rating__ring" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />}
                </motion.span>
                <span style={{ color: sel ? 'var(--text-1)' : undefined }}>{r.label}</span>
                <small>{r.hint}</small>
              </motion.button>
            );
          })}
        </div>
        {!draft.rating && <p className="t-small" style={{ marginTop: 10, fontSize: 12 }}>Leave it unrated and the day stays gray on your calendar.</p>}
      </Section>

      <Section title="Note" aside={<span className="t-eyebrow">Optional</span>}>
        <textarea className="input" rows={3} maxLength={400} value={draft.note} placeholder="Anything worth remembering about today?" onChange={(e) => set({ note: e.target.value })} />
      </Section>
    </Sheet>
  );
}
