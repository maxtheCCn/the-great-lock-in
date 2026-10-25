/** Form sections shared by onboarding and the Profile settings screens. */
import { AnimatePresence, motion } from 'motion/react';
import { BellRing, Info, Plus, Smartphone, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Chip, DatePicker, Field, Option, Segmented, Stepper, TimePicker, Toggle } from '@/design/primitives';
import { GOAL_META, HABIT_ICONS, PREFERENCE_META } from '@/components/icons';
import { addDays, diffDays, formatDate, todayISO } from '@/domain/dates';
import type { AgeGroup, Experience, GoalId, HabitDef, ISODate, TrainingPreference } from '@/data/types';
import { notificationSupport, requestNotificationPermission, type NotificationSupport } from '@/services/reminders';

export const PRESET_HABITS: HabitDef[] = [
  { id: 'water', label: 'Drink water', icon: 'water' },
  { id: 'steps', label: 'Daily steps', icon: 'steps' },
  { id: 'stretch', label: 'Stretch / mobility', icon: 'stretch' },
  { id: 'sun', label: 'Morning daylight', icon: 'sun' },
  { id: 'veg', label: 'Eat vegetables', icon: 'veg' },
  { id: 'read', label: 'Read', icon: 'read' },
  { id: 'meditate', label: 'Breathe / meditate', icon: 'meditate' },
  { id: 'noscreen', label: 'No screens before bed', icon: 'noscreen' },
  { id: 'walk', label: 'Walk outside', icon: 'walk' },
];

const NAME_IDEAS = ['Christmas Lock In', 'Summer Transformation', '90-Day Strength', 'Muscle Building Journey', 'Consistency Challenge', 'Sleep & Recovery Reset'];

function nextDate(month: number, day: number, from: ISODate): ISODate {
  const y = Number(from.slice(0, 4));
  const cand = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return diffDays(from, cand) >= 14 ? cand : `${y + 1}-${cand.slice(5)}`;
}

/* ── Lock In basics ──────────────────────────────────────── */

export interface BasicsValue {
  name: string;
  startDate: ISODate;
  targetDate: ISODate;
  motivation: string;
}

export function basicsError(v: BasicsValue): string | null {
  if (!v.name.trim()) return 'Give your Lock In a name.';
  if (diffDays(v.startDate, v.targetDate) < 6) return 'Make the target date at least a week after the start.';
  if (diffDays(v.startDate, v.targetDate) > 730) return 'Keep a Lock In to two years or less.';
  return null;
}

export function BasicsEditor({ value, onChange, showIdeas = true }: { value: BasicsValue; onChange: (v: BasicsValue) => void; showIdeas?: boolean }) {
  const total = diffDays(value.startDate, value.targetDate) + 1;
  const set = (p: Partial<BasicsValue>) => onChange({ ...value, ...p });
  const pickName = (n: string) => {
    const p: Partial<BasicsValue> = { name: n };
    if (n.startsWith('Christmas')) p.targetDate = nextDate(12, 24, value.startDate);
    else if (n.startsWith('Summer')) p.targetDate = nextDate(6, 21, value.startDate);
    else if (n.startsWith('90')) p.targetDate = addDays(value.startDate, 89);
    set(p);
  };
  return (
    <div className="stack gap-5">
      <Field label="Lock In name" htmlFor="li-name">
        <input
          id="li-name"
          className="input input--big"
          value={value.name}
          maxLength={48}
          placeholder="Christmas Lock In"
          autoComplete="off"
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>
      {showIdeas && (
        <div className="row wrap gap-2" style={{ marginTop: -8 }}>
          {NAME_IDEAS.map((n) => (
            <Chip key={n} selected={value.name === n} onClick={() => pickName(n)}>
              {n}
            </Chip>
          ))}
        </div>
      )}
      <div className="grid-2">
        <Field label="Start">
          <DatePicker label="Start date" value={value.startDate} onChange={(d) => set({ startDate: d })} min={addDays(todayISO(), -60)} />
        </Field>
        <Field label="Target">
          <DatePicker label="Target date" value={value.targetDate} onChange={(d) => set({ targetDate: d })} min={addDays(value.startDate, 6)} />
        </Field>
      </div>
      <div className="row between wrap gap-3">
        <div className="duration-chip">
          <span className="t-num" style={{ fontSize: 26, color: 'var(--mint)' }}>
            {Math.max(0, total)}
          </span>
          <span className="t-small">days · ends {formatDate(value.targetDate, { day: 'numeric', month: 'short' })}</span>
        </div>
        <div className="row gap-2">
          {[30, 60, 90].map((n) => (
            <Chip key={n} selected={total === n} onClick={() => set({ targetDate: addDays(value.startDate, n - 1) })}>
              {n}d
            </Chip>
          ))}
        </div>
      </div>
      <Field label="Motivation" hint="Optional" htmlFor="li-why">
        <textarea
          id="li-why"
          className="input"
          rows={3}
          maxLength={280}
          value={value.motivation}
          placeholder="Why does this matter to you?"
          onChange={(e) => set({ motivation: e.target.value })}
        />
      </Field>
    </div>
  );
}

/* ── Goals ───────────────────────────────────────────────── */

export function GoalsEditor({ value, onChange }: { value: GoalId[]; onChange: (v: GoalId[]) => void }) {
  const toggle = (g: GoalId) => onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g]);
  return (
    <div className="stack gap-2">
      {(Object.keys(GOAL_META) as GoalId[]).map((g) => {
        const m = GOAL_META[g];
        const Icon = m.icon;
        return <Option key={g} multi selected={value.includes(g)} onClick={() => toggle(g)} icon={<Icon />} title={m.label} description={m.desc} />;
      })}
    </div>
  );
}

/* ── Training preferences ────────────────────────────────── */

export interface TrainingValue {
  experience: Experience;
  weeklyFrequency: number;
  preferences: TrainingPreference[];
  ageGroup: AgeGroup;
}

const EXPERIENCE: { value: Experience; label: string; desc: string }[] = [
  { value: 'new', label: 'Just starting', desc: 'New to structured training.' },
  { value: 'some', label: 'Some experience', desc: 'Trained on and off.' },
  { value: 'experienced', label: 'Experienced', desc: 'Training regularly for 1+ years.' },
  { value: 'advanced', label: 'Advanced', desc: 'Years of consistent, structured training.' },
];

export function TrainingEditor({ value, onChange, showAge = true }: { value: TrainingValue; onChange: (v: TrainingValue) => void; showAge?: boolean }) {
  const set = (p: Partial<TrainingValue>) => onChange({ ...value, ...p });
  const togglePref = (p: TrainingPreference) =>
    set({ preferences: value.preferences.includes(p) ? value.preferences.filter((x) => x !== p) : [...value.preferences, p] });
  return (
    <div className="stack gap-6">
      <Field label="Training experience">
        <div className="stack gap-2">
          {EXPERIENCE.map((e) => (
            <Option key={e.value} selected={value.experience === e.value} onClick={() => set({ experience: e.value })} title={e.label} description={e.desc} />
          ))}
        </div>
      </Field>
      <Field label="Sessions per week" hint="Rest days are part of the plan">
        <div className="stack gap-3">
          <div className="freq-dots" aria-hidden>
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} data-on={i < value.weeklyFrequency}>
                {i + 1}
              </span>
            ))}
          </div>
          <div className="row between">
            <span className="t-small">
              {value.weeklyFrequency} training {value.weeklyFrequency === 1 ? 'day' : 'days'}, {7 - value.weeklyFrequency} recovery
            </span>
            <Stepper label="sessions per week" value={value.weeklyFrequency} min={1} max={7} onChange={(n) => set({ weeklyFrequency: n })} />
          </div>
          {value.weeklyFrequency === 7 && (
            <div className="ob__note ob__note--warn">
              <TriangleAlert />
              <span>Daily training can work with easy sessions, but planned rest helps you recover and keep progressing.</span>
            </div>
          )}
        </div>
      </Field>
      <Field label="How you like to train" hint="Pick any">
        <div className="row wrap gap-2">
          {(Object.keys(PREFERENCE_META) as TrainingPreference[]).map((p) => {
            const m = PREFERENCE_META[p];
            const Icon = m.icon;
            return (
              <Chip key={p} selected={value.preferences.includes(p)} onClick={() => togglePref(p)} icon={<Icon />}>
                {m.label}
              </Chip>
            );
          })}
        </div>
      </Field>
      {showAge && (
        <Field label="Age group" hint="Optional · tailors guidance">
          <Segmented<AgeGroup>
            value={value.ageGroup}
            onChange={(a) => set({ ageGroup: a })}
            options={[
              { value: 'under16', label: 'Under 16' },
              { value: '16to17', label: '16-17' },
              { value: 'adult', label: '18+' },
              { value: 'unspecified', label: 'Skip' },
            ]}
          />
        </Field>
      )}
    </div>
  );
}

/* ── Habits ──────────────────────────────────────────────── */

export function HabitsEditor({ value, onChange }: { value: HabitDef[]; onChange: (v: HabitDef[]) => void }) {
  const [custom, setCustom] = useState('');
  const has = (id: string) => value.some((h) => h.id === id);
  const toggle = (h: HabitDef) => onChange(has(h.id) ? value.filter((x) => x.id !== h.id) : [...value, h]);
  const customs = value.filter((h) => !PRESET_HABITS.some((p) => p.id === h.id));
  const addCustom = () => {
    const label = custom.trim();
    if (!label) return;
    onChange([...value, { id: `c-${Date.now().toString(36)}`, label, icon: 'custom' }]);
    setCustom('');
  };
  return (
    <div className="stack gap-5">
      <div className="row wrap gap-2">
        {PRESET_HABITS.map((h) => {
          const Icon = HABIT_ICONS[h.icon];
          return (
            <Chip key={h.id} selected={has(h.id)} onClick={() => toggle(h)} icon={<Icon />}>
              {h.label}
            </Chip>
          );
        })}
      </div>
      <Field label="Your own habit">
        <div className="row gap-2">
          <input
            className="input grow"
            value={custom}
            maxLength={36}
            placeholder="e.g. 10 min mobility"
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          />
          <Button variant="secondary" onClick={addCustom} disabled={!custom.trim()} icon={<Plus />} aria-label="Add habit" style={{ height: 52 }} />
        </div>
      </Field>
      <AnimatePresence initial={false}>
        {customs.length > 0 && (
          <motion.div className="row wrap gap-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {customs.map((h) => (
              <Chip key={h.id} selected onClick={() => toggle(h)} icon={<X />}>
                {h.label}
              </Chip>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <p className="t-small">{value.length ? `${value.length} habit${value.length === 1 ? '' : 's'} on your daily check-in.` : 'No habits selected. You can add some later.'}</p>
    </div>
  );
}

/* ── Reminder ────────────────────────────────────────────── */

export function ReminderEditor({
  enabled,
  time,
  onChange,
}: {
  enabled: boolean;
  time: string;
  onChange: (v: { enabled: boolean; time: string }) => void;
}) {
  const [support, setSupport] = useState<NotificationSupport>(() => notificationSupport());
  const toggle = async (on: boolean) => {
    onChange({ enabled: on, time });
    if (on && support === 'default') setSupport(await requestNotificationPermission());
  };
  return (
    <div className="stack gap-4">
      <div className="panel panel--tight">
        <div className="row gap-3">
          <span className="option__icon">
            <BellRing />
          </span>
          <div className="stack grow">
            <span className="t-h3" style={{ fontSize: 15 }}>
              Daily check-in reminder
            </span>
            <span className="t-small">Skipped automatically once you've checked in.</span>
          </div>
          <Toggle label="Daily reminder" checked={enabled} onChange={toggle} />
        </div>
        <AnimatePresence initial={false}>
          {enabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
              <div style={{ paddingTop: 16 }}>
                <TimePicker label="Reminder time" value={time} onChange={(t) => onChange({ enabled, time: t })} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {enabled && (
        <div className="row gap-2 wrap">
          {support === 'granted' && <Badge>Notifications allowed</Badge>}
          {support === 'denied' && <Badge tone="warn">Notifications blocked in browser settings</Badge>}
          {support === 'needs-install' && (
            <Badge tone="warn" icon={<Smartphone />}>
              Add to Home Screen to enable notifications
            </Badge>
          )}
          {support === 'unsupported' && <Badge tone="muted">Notifications not supported here</Badge>}
          {support === 'default' && (
            <Button size="sm" variant="secondary" onClick={async () => setSupport(await requestNotificationPermission())}>
              Allow notifications
            </Button>
          )}
        </div>
      )}
      <div className="ob__note">
        <Info />
        <span>
          Web apps can't schedule alarms while fully closed. TGLI notifies you when it's open or recently used, and always shows a reminder on Home after
          your chosen time. On iPhone, notifications need TGLI on your Home Screen (iOS 16.4+).
        </span>
      </div>
    </div>
  );
}
