import { useEffect, useState } from 'react';
import { Sheet } from '@/design/Sheet';
import { Button, Chip, DatePicker, Field, SelectPicker, Stepper } from '@/design/primitives';
import { db } from '@/data/db';
import { saveGoal, syncGoalCompletion } from '@/data/repo';
import type { GoalMetric, ISODate, LockIn } from '@/data/types';
import { addDays, diffDays, formatShort, minDate, startOfWeek, todayISO } from '@/domain/dates';
import { GOAL_METRIC_LABELS } from '@/domain/goals';
import { toast, useUI } from '@/state/ui';

type PeriodPreset = 'week' | 'next7' | 'lockin' | 'custom';

const TEMPLATES: { title: string; metric: GoalMetric; target: number; period: PeriodPreset; sleep?: number }[] = [
  { title: 'Three workouts this week', metric: 'workouts', target: 3, period: 'week' },
  { title: 'Check in five times', metric: 'checkins', target: 5, period: 'week' },
  { title: 'Five nights of 7+ hours', metric: 'sleepNights', target: 5, period: 'week', sleep: 7 },
];

export function GoalSheet({ lockIn }: { lockIn: LockIn }) {
  const sheet = useUI((s) => s.sheet);
  const closeSheet = useUI((s) => s.closeSheet);
  const open = sheet?.type === 'goal';
  const editId = sheet?.type === 'goal' ? sheet.id : undefined;
  const today = todayISO();

  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('workouts');
  const [target, setTarget] = useState(3);
  const [sleep, setSleep] = useState(7);
  const [habitId, setHabitId] = useState<string>(lockIn.habits[0]?.id ?? '');
  const [preset, setPreset] = useState<PeriodPreset>('week');
  const [start, setStart] = useState<ISODate>(today);
  const [end, setEnd] = useState<ISODate>(today);
  const [manual, setManual] = useState(0);
  const [exists, setExists] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);
    if (p === 'week') {
      setStart(startOfWeek(today));
      setEnd(addDays(startOfWeek(today), 6));
    } else if (p === 'next7') {
      setStart(today);
      setEnd(addDays(today, 6));
    } else if (p === 'lockin') {
      setStart(today > lockIn.startDate ? today : lockIn.startDate);
      setEnd(lockIn.targetDate);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    (async () => {
      const g = editId ? await db.goals.get(editId) : undefined;
      setExists(!!g);
      if (g) {
        setTitle(g.title);
        setMetric(g.metric);
        setTarget(g.target);
        setSleep(g.sleepThreshold ?? 7);
        setHabitId(g.habitId ?? lockIn.habits[0]?.id ?? '');
        setPreset('custom');
        setStart(g.startDate);
        setEnd(g.endDate);
        setManual(g.manualProgress);
      } else {
        setTitle('');
        setMetric('workouts');
        setTarget(3);
        setManual(0);
        applyPreset('week');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const valid = title.trim().length > 0 && end >= start && (metric !== 'habit' || !!habitId);

  const save = async () => {
    setSaving(true);
    try {
      await saveGoal({
        id: editId,
        lockInId: lockIn.id,
        title: title.trim(),
        metric,
        target,
        manualProgress: manual,
        sleepThreshold: metric === 'sleepNights' ? sleep : null,
        habitId: metric === 'habit' ? habitId : null,
        startDate: start,
        endDate: minDate(end, lockIn.targetDate),
      });
      const done = await syncGoalCompletion(lockIn.id);
      closeSheet();
      toast(done.length ? 'Goal saved and already reached' : exists ? 'Goal updated' : 'Goal created', { tone: 'success' });
    } catch {
      toast('Could not save the goal.', { tone: 'error' });
      setSaving(false);
    }
  };

  const metrics: GoalMetric[] = ['workouts', 'checkins', 'sleepNights', ...(lockIn.habits.length ? (['habit'] as GoalMetric[]) : []), 'manual'];

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      locked={saving}
      eyebrow="Mini goal"
      title={exists ? 'Edit goal' : 'New goal'}
      full
      footer={
        <Button block size="lg" disabled={!valid} loading={saving} onClick={save}>
          {exists ? 'Save changes' : 'Create goal'}
        </Button>
      }
    >
      <div className="stack gap-5">
        {!exists && (
          <div className="row wrap gap-2">
            {TEMPLATES.map((t) => (
              <Chip
                key={t.title}
                selected={title === t.title}
                onClick={() => {
                  setTitle(t.title);
                  setMetric(t.metric);
                  setTarget(t.target);
                  if (t.sleep) setSleep(t.sleep);
                  applyPreset(t.period);
                }}
              >
                {t.title}
              </Chip>
            ))}
          </div>
        )}
        <Field label="Goal">
          <input className="input" value={title} maxLength={60} placeholder="e.g. Three workouts this week" onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Measured by">
          <SelectPicker label="Goal metric" value={metric} onChange={setMetric} options={metrics.map((m) => ({ value: m, label: GOAL_METRIC_LABELS[m] }))} />
        </Field>
        {metric === 'sleepNights' && (
          <Field label="Good night means at least">
            <Stepper label="hours" value={sleep} min={5} max={10} step={0.5} format={(v) => `${v}h`} onChange={setSleep} />
          </Field>
        )}
        {metric === 'habit' && (
          <Field label="Habit">
            <SelectPicker label="Habit" value={habitId} onChange={setHabitId} options={lockIn.habits.map((h) => ({ value: h.id, label: h.label }))} />
          </Field>
        )}
        <Field label="Target">
          <div className="row between">
            <span className="t-small">{metric === 'manual' ? 'Times to complete' : 'Count to reach'}</span>
            <Stepper label="target" value={target} min={1} max={100} onChange={setTarget} />
          </div>
        </Field>
        <Field label="Period">
          <div className="row wrap gap-2">
            {(
              [
                ['week', 'This week'],
                ['next7', 'Next 7 days'],
                ['lockin', 'Until Lock In ends'],
                ['custom', 'Custom'],
              ] as [PeriodPreset, string][]
            ).map(([p, l]) => (
              <Chip key={p} selected={preset === p} onClick={() => applyPreset(p)}>
                {l}
              </Chip>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className="grid-2" style={{ marginTop: 8 }}>
              <DatePicker label="Goal start" value={start} onChange={setStart} min={lockIn.startDate} max={lockIn.targetDate} />
              <DatePicker label="Goal end" value={end} onChange={setEnd} min={start} max={lockIn.targetDate} />
            </div>
          ) : (
            <span className="t-small" style={{ marginTop: 4 }}>
              {formatShort(start)} - {formatShort(end)} · {diffDays(start, end) + 1} days
            </span>
          )}
        </Field>
        <p className="t-small" style={{ fontSize: 12 }}>
          Goals are encouragement, not obligations. If a period ends early, nothing is lost. Archive it or set a new one.
        </p>
      </div>
    </Sheet>
  );
}
