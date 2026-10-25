import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Dumbbell, Plus, Search, Trash, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/design/Sheet';
import { Badge, Button, Chip, DatePicker, Field, IconButton, Stepper } from '@/design/primitives';
import { confirmAction } from '@/design/Overlays';
import { db, uid } from '@/data/db';
import { deleteWorkout, saveWorkout, syncGoalCompletion } from '@/data/repo';
import { useSettings } from '@/data/settings';
import { EXERCISES, type ExerciseDef } from '@/data/training/exercises';
import { MUSCLES, MUSCLE_BY_ID } from '@/data/training/muscles';
import type { LockIn, MuscleId, WorkoutExercise } from '@/data/types';
import { todayISO } from '@/domain/dates';
import { toast, useUI } from '@/state/ui';
import './sheets.css';

const LB = 0.45359237;
const CATS: { value: ExerciseDef['category'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'arms', label: 'Arms' },
  { value: 'core', label: 'Core' },
];

function suggestTitle(ex: WorkoutExercise[]): string {
  if (!ex.length) return 'Workout';
  const counts = new Map<string, number>();
  for (const e of ex) for (const m of e.primary) counts.set(MUSCLE_BY_ID[m].group, (counts.get(MUSCLE_BY_ID[m].group) ?? 0) + e.sets);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (top.length > 2) return 'Full body';
  const names: Record<string, string> = { push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core' };
  return top.map(([g]) => names[g]).join(' & ') + ' day';
}

export function WorkoutSheet({ lockIn }: { lockIn: LockIn }) {
  const sheet = useUI((s) => s.sheet);
  const closeSheet = useUI((s) => s.closeSheet);
  const settings = useSettings();
  const open = sheet?.type === 'workout';
  const editId = sheet?.type === 'workout' ? sheet.id : undefined;
  const imperial = settings?.units === 'imperial';

  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicking(false);
    setSaving(false);
    (async () => {
      const w = editId ? await db.workouts.get(editId) : undefined;
      setExists(!!w);
      setDate(w?.date ?? (sheet?.type === 'workout' ? sheet.date : undefined) ?? todayISO());
      const prefill = sheet?.type === 'workout' ? sheet.prefill : undefined;
      setTitle(w?.title ?? prefill?.title ?? '');
      setDuration(w?.durationMin ?? null);
      setNote(w?.note ?? '');
      setExercises(w?.exercises ?? prefill?.exercises ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const add = (e: ExerciseDef | { name: string; primary: MuscleId[]; secondary: MuscleId[] }) => {
    setExercises((xs) => [...xs, { id: uid(), exerciseId: 'id' in e ? e.id : undefined, name: e.name, primary: e.primary, secondary: e.secondary, sets: 3, reps: null, weight: null }]);
    setPicking(false);
  };
  const update = (id: string, p: Partial<WorkoutExercise>) => setExercises((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = async () => {
    setSaving(true);
    try {
      await saveWorkout({
        id: editId,
        lockInId: lockIn.id,
        date,
        title: title.trim() || suggestTitle(exercises),
        durationMin: duration,
        exercises,
        note: note.trim(),
        source: 'manual',
      });
      await syncGoalCompletion(lockIn.id);
      closeSheet();
      toast(exists ? 'Workout updated' : 'Workout logged', { tone: 'success' });
    } catch (e) {
      console.error(e);
      toast('Could not save the workout.', { tone: 'error' });
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editId) return;
    if (!(await confirmAction({ title: 'Delete this workout?', confirmLabel: 'Delete', tone: 'danger' }))) return;
    await deleteWorkout(editId);
    closeSheet();
    toast('Workout deleted');
  };

  const totalSets = exercises.reduce((a, e) => a + e.sets, 0);

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      locked={saving}
      full
      eyebrow={picking ? 'Add exercise' : exists ? 'Edit workout' : 'Log workout'}
      title={picking ? 'Exercise library' : title.trim() || suggestTitle(exercises)}
      headerRight={
        picking ? (
          <IconButton label="Back to workout" size="sm" onClick={() => setPicking(false)}>
            <ArrowLeft />
          </IconButton>
        ) : undefined
      }
      footer={
        picking ? undefined : (
          <div className="row gap-2">
            {exists && <Button variant="danger" icon={<Trash />} aria-label="Delete workout" onClick={remove} style={{ width: 56, padding: 0 }} />}
            <Button block size="lg" loading={saving} onClick={save} disabled={!exercises.length}>
              {exercises.length ? `Save · ${totalSets} sets` : 'Add an exercise to save'}
            </Button>
          </div>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {picking ? (
          <motion.div key="pick" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.25 }}>
            <ExercisePicker onPick={add} />
          </motion.div>
        ) : (
          <motion.div key="form" className="stack gap-5" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
            <div className="grid-2">
              <Field label="Date">
                <DatePicker label="Workout date" value={date} onChange={setDate} max={todayISO()} />
              </Field>
              <Field label="Duration" hint="min">
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="Optional"
                  value={duration ?? ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    setDuration(Number.isFinite(v) ? Math.min(600, v) : null);
                  }}
                />
              </Field>
            </div>
            <Field label="Title" hint="Optional">
              <input className="input" value={title} maxLength={40} placeholder={suggestTitle(exercises)} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            <div className="stack gap-3">
              <div className="row between">
                <span className="t-eyebrow">Exercises</span>
                <span className="t-eyebrow">{exercises.length}</span>
              </div>
              <AnimatePresence initial={false}>
                {exercises.map((e) => (
                  <motion.div key={e.id} className="ex-card" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
                    <div className="row between gap-2">
                      <div className="stack" style={{ minWidth: 0 }}>
                        <span className="ex-card__name">{e.name}</span>
                        <span className="ex-card__muscles">
                          {e.primary.map((m) => MUSCLE_BY_ID[m].label).join(', ')}
                          {e.secondary.length > 0 && <em> + {e.secondary.map((m) => MUSCLE_BY_ID[m].label).join(', ')}</em>}
                        </span>
                      </div>
                      <IconButton label={`Remove ${e.name}`} size="sm" variant="plain" onClick={() => setExercises((xs) => xs.filter((x) => x.id !== e.id))}>
                        <X />
                      </IconButton>
                    </div>
                    <div className="ex-card__row">
                      <div className="stack gap-1">
                        <span className="t-eyebrow" style={{ fontSize: 9 }}>
                          Sets
                        </span>
                        <Stepper label="sets" value={e.sets} min={1} max={20} onChange={(n) => update(e.id, { sets: n })} />
                      </div>
                      <label className="ex-card__mini">
                        <span className="t-eyebrow" style={{ fontSize: 9 }}>
                          Reps
                        </span>
                        <input className="input" inputMode="numeric" placeholder="—" value={e.reps ?? ''} onChange={(ev) => update(e.id, { reps: ev.target.value ? Math.min(999, parseInt(ev.target.value, 10) || 0) : null })} />
                      </label>
                      <label className="ex-card__mini">
                        <span className="t-eyebrow" style={{ fontSize: 9 }}>
                          {imperial ? 'lb' : 'kg'}
                        </span>
                        <input
                          className="input"
                          inputMode="decimal"
                          placeholder="—"
                          defaultValue={e.weight === null ? '' : String(Math.round((imperial ? e.weight / LB : e.weight) * 10) / 10)}
                          onBlur={(ev) => {
                            const v = parseFloat(ev.target.value.replace(',', '.'));
                            update(e.id, { weight: Number.isFinite(v) ? Math.round((imperial ? v * LB : v) * 100) / 100 : null });
                          }}
                        />
                      </label>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <Button variant="secondary" block icon={<Plus />} onClick={() => setPicking(true)}>
                Add exercise
              </Button>
            </div>

            <Field label="Note" hint="Optional">
              <textarea className="input" rows={2} value={note} maxLength={300} placeholder="How did it feel?" onChange={(e) => setNote(e.target.value)} />
            </Field>
            <p className="t-small" style={{ fontSize: 12 }}>
              Sets feed the muscle map: primary muscles count 1 set, secondary muscles ½. Detailed logging and PRs live in NW Log. Integration is planned for a later phase.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

function ExercisePicker({ onPick }: { onPick: (e: ExerciseDef | { name: string; primary: MuscleId[]; secondary: MuscleId[] }) => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]['value']>('all');
  const [custom, setCustom] = useState<{ name: string; primary: MuscleId[]; secondary: MuscleId[] } | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return EXERCISES.filter((e) => (cat === 'all' || e.category === cat) && (!s || e.name.toLowerCase().includes(s) || e.primary.some((m) => MUSCLE_BY_ID[m].label.toLowerCase().includes(s))));
  }, [q, cat]);

  if (custom) {
    const toggle = (k: 'primary' | 'secondary', m: MuscleId) =>
      setCustom({
        ...custom,
        [k]: custom[k].includes(m) ? custom[k].filter((x) => x !== m) : [...custom[k], m],
        ...(k === 'primary' ? { secondary: custom.secondary.filter((x) => x !== m) } : { primary: custom.primary.filter((x) => x !== m) }),
      });
    return (
      <div className="stack gap-5">
        <Field label="Exercise name">
          <input className="input" autoFocus value={custom.name} maxLength={40} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="e.g. Cable lateral raise" />
        </Field>
        <Field label="Primary muscles">
          <div className="row wrap gap-2">
            {MUSCLES.map((m) => (
              <Chip key={m.id} selected={custom.primary.includes(m.id)} onClick={() => toggle('primary', m.id)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Secondary muscles" hint="Optional · counts ½ set">
          <div className="row wrap gap-2">
            {MUSCLES.map((m) => (
              <Chip key={m.id} selected={custom.secondary.includes(m.id)} onClick={() => toggle('secondary', m.id)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </Field>
        <div className="grid-2">
          <Button variant="secondary" onClick={() => setCustom(null)}>
            Cancel
          </Button>
          <Button disabled={!custom.name.trim() || !custom.primary.length} onClick={() => onPick({ ...custom, name: custom.name.trim() })}>
            Add
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack gap-4">
      <div className="search">
        <Search />
        <input className="input" placeholder="Search exercises or muscles" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="row gap-2" style={{ overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -18px', padding: '0 18px' }}>
        {CATS.map((c) => (
          <Chip key={c.value} selected={cat === c.value} onClick={() => setCat(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="list">
        {list.map((e) => (
          <button key={e.id} className="list-row" onClick={() => onPick(e)}>
            <span className="list-row__icon">
              <Dumbbell />
            </span>
            <span className="stack grow">
              <span className="list-row__title">{e.name}</span>
              <span className="list-row__sub">
                {e.primary.map((m) => MUSCLE_BY_ID[m].label).join(', ')}
                {e.secondary.length > 0 && ` · ${e.secondary.map((m) => MUSCLE_BY_ID[m].label).join(', ')}`}
              </span>
            </span>
            <Plus size={18} color="var(--mint)" />
          </button>
        ))}
        {list.length === 0 && (
          <div className="list-row">
            <span className="t-small">No match in the library.</span>
          </div>
        )}
      </div>
      <Button variant="secondary" icon={<Plus />} onClick={() => setCustom({ name: q, primary: [], secondary: [] })}>
        Create custom exercise
      </Button>
      <Badge tone="muted">Starter library · {EXERCISES.length} exercises</Badge>
    </div>
  );
}
