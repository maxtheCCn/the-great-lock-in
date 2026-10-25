import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';
import { ChevronLeft, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, Panel, Toggle } from '@/design/primitives';
import { prefersReducedMotion } from '@/design/visuals';
import { addDays, formatRange, todayISO, diffDays } from '@/domain/dates';
import { createLockIn } from '@/data/repo';
import { getSettings, updateSettings } from '@/data/settings';
import { db, requestPersistence } from '@/data/db';
import type { GoalId, HabitDef, LockIn } from '@/data/types';
import { Emblem } from '@/components/Emblem';
import { Replay } from '@/features/archive/Replay';
import { Film } from 'lucide-react';
import { GOAL_META } from '@/components/icons';
import { toast } from '@/state/ui';
import { vibrate } from '@/services/platform';
import { Welcome } from './Welcome';
import { Activation } from './Activation';
import { BasicsEditor, GoalsEditor, HabitsEditor, ReminderEditor, TrainingEditor, basicsError, PRESET_HABITS, type BasicsValue, type TrainingValue } from './editors';
import './onboarding.css';

interface Draft {
  basics: BasicsValue;
  goals: GoalId[];
  training: TrainingValue;
  habits: HabitDef[];
  showSupplements: boolean;
  reminder: { enabled: boolean; time: string };
}

const STEPS = ['create', 'goals', 'training', 'habits', 'reminder', 'activate'] as const;
type Step = (typeof STEPS)[number];

const COPY: Record<Step, { title: string; desc: string }> = {
  create: { title: 'Create your Lock In', desc: 'A time-boxed commitment to yourself. Name it, set the window, remember why.' },
  goals: { title: 'Choose your goals', desc: 'Pick what this Lock In is about. Select as many as fit.' },
  training: { title: 'How you train', desc: 'This shapes your dashboard and, if you use it, the optional coach.' },
  habits: { title: 'Daily habits', desc: 'Small things you want to tick off in your daily check-in. Completely optional.' },
  reminder: { title: 'Daily reminder', desc: 'One gentle nudge to check in. Off by default. Your call.' },
  activate: { title: 'Ready to lock in?', desc: 'Everything stays private on this device. Press and hold to activate.' },
};

export function Onboarding({ mode = 'first', onDone }: { mode?: 'first' | 'new'; onDone: () => void }) {
  const [welcome, setWelcome] = useState(mode === 'first');
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [activating, setActivating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today = todayISO();
  const [draft, setDraft] = useState<Draft>({
    basics: { name: '', startDate: today, targetDate: addDays(today, 89), motivation: '' },
    goals: [],
    training: { experience: 'some', weeklyFrequency: 3, preferences: ['gym'], ageGroup: 'unspecified' },
    habits: [PRESET_HABITS[0], PRESET_HABITS[2]],
    showSupplements: true,
    reminder: { enabled: false, time: '20:30' },
  });

  const [previous, setPrevious] = useState<LockIn | null>(null);
  const [intro, setIntro] = useState(mode === 'new');
  const [replay, setReplay] = useState(false);
  useEffect(() => {
    if (mode !== 'new') return;
    db.lockIns
      .where('status')
      .equals('completed')
      .sortBy('completedAt')
      .then((rows) => {
        const last = rows[rows.length - 1];
        if (!last) {
          setIntro(false);
          return;
        }
        setPrevious(last);
        setDraft((d) => ({
          ...d,
          goals: last.goals,
          habits: last.habits,
          training: { ...d.training, experience: last.experience, weeklyFrequency: last.weeklyFrequency, preferences: last.preferences },
        }));
      });
  }, [mode]);

  const step = STEPS[index];
  const error = step === 'create' ? basicsError(draft.basics) : step === 'goals' && !draft.goals.length ? 'Choose at least one goal.' : null;
  const youth = draft.training.ageGroup === 'under16' || draft.training.ageGroup === '16to17';

  const go = (d: 1 | -1) => {
    setDir(d);
    setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + d)));
  };

  const activate = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const lockIn = await createLockIn({
        name: draft.basics.name.trim(),
        startDate: draft.basics.startDate,
        targetDate: draft.basics.targetDate,
        motivation: draft.basics.motivation.trim(),
        goals: draft.goals,
        experience: draft.training.experience,
        weeklyFrequency: draft.training.weeklyFrequency,
        preferences: draft.training.preferences,
        habits: draft.habits,
      });
      const current = await getSettings();
      await updateSettings({
        onboarded: true,
        ageGroup: draft.training.ageGroup,
        showSupplements: youth ? false : draft.showSupplements,
        reminder: draft.reminder,
        dashboard: current.dashboard,
      });
      void requestPersistence();
      setActivating(lockIn.name);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create your Lock In.', { tone: 'error' });
      setSaving(false);
    }
  };

  if (intro && previous) {
    return (
      <div className="ob">
        <div className="ob__frame">
          <div className="welcome">
            <Emblem milestoneKey="lockin-complete" size={130} />
            <div className="t-eyebrow" style={{ marginTop: 28, color: 'var(--mint)' }}>
              Lock In complete
            </div>
            <div className="welcome__kicker" style={{ marginTop: 14, letterSpacing: '0.04em', marginRight: 0, fontSize: 26, color: 'var(--text-1)' }}>
              {previous.name}
            </div>
            <p className="t-small" style={{ marginTop: 12, maxWidth: '30ch' }}>
              Archived with everything preserved. Look back, then start your next Lock In. Your goals and habits carry over as a starting point.
            </p>
            <div className="welcome__cta" style={{ position: 'absolute' }}>
              <Button variant="secondary" size="lg" block icon={<Film />} onClick={() => setReplay(true)}>
                Watch Transformation Replay
              </Button>
              <Button size="lg" block onClick={() => setIntro(false)}>
                Start a new Lock In
              </Button>
            </div>
          </div>
        </div>
        <AnimatePresence>{replay && <Replay lockInId={previous.id} onClose={() => setReplay(false)} />}</AnimatePresence>
      </div>
    );
  }

  if (welcome) {
    return (
      <div className="ob">
        <div className="ob__frame">
          <Welcome onBegin={() => setWelcome(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="ob">
      <div className="ob__frame">
        <div className="ob__top">
          <IconButton label="Back" size="sm" onClick={() => (index === 0 ? (mode === 'first' ? setWelcome(true) : setIntro(true)) : go(-1))} variant="plain">
            <ChevronLeft />
          </IconButton>
          <div className="ob__progress" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s}>
                <motion.i initial={false} animate={{ scaleX: i <= index ? 1 : 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
              </span>
            ))}
          </div>
          <span className="ob__count">
            {String(index + 1).padStart(2, '0')}/{String(STEPS.length).padStart(2, '0')}
          </span>
        </div>

        <div className="ob__body">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={step}
              className="ob__step"
              custom={dir}
              variants={{
                enter: (d: number) => ({ x: d * 60, opacity: 0, filter: 'blur(6px)' }),
                center: { x: 0, opacity: 1, filter: 'blur(0px)' },
                exit: (d: number) => ({ x: d * -60, opacity: 0, filter: 'blur(6px)' }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <header className="ob__head">
                <h1 className="ob__title">{COPY[step].title}</h1>
                <p className="ob__desc">{COPY[step].desc}</p>
              </header>

              {step === 'create' && <BasicsEditor value={draft.basics} onChange={(basics) => setDraft({ ...draft, basics })} />}
              {step === 'goals' && <GoalsEditor value={draft.goals} onChange={(goals) => setDraft({ ...draft, goals })} />}
              {step === 'training' && <TrainingEditor value={draft.training} onChange={(training) => setDraft({ ...draft, training })} />}
              {step === 'habits' && (
                <div className="stack gap-6">
                  <HabitsEditor value={draft.habits} onChange={(habits) => setDraft({ ...draft, habits })} />
                  {youth ? (
                    <div className="ob__note">
                      <Info />
                      <span>Supplement tracking is turned off for under-18s. Food, sleep and training matter far more at your age.</span>
                    </div>
                  ) : (
                    <Panel tight>
                      <div className="row gap-3">
                        <div className="stack grow">
                          <span className="t-h3" style={{ fontSize: 15 }}>
                            Track creatine & protein
                          </span>
                          <span className="t-small">Optional yes/no fields. Personal log only, never rated or recommended.</span>
                        </div>
                        <Toggle label="Track supplements" checked={draft.showSupplements} onChange={(v) => setDraft({ ...draft, showSupplements: v })} />
                      </div>
                    </Panel>
                  )}
                </div>
              )}
              {step === 'reminder' && <ReminderEditor enabled={draft.reminder.enabled} time={draft.reminder.time} onChange={(reminder) => setDraft({ ...draft, reminder })} />}
              {step === 'activate' && <ActivateStep draft={draft} onActivate={activate} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {step !== 'activate' && (
          <div className="ob__footer">
            <Button size="lg" block disabled={!!error} onClick={() => go(1)}>
              {error ?? 'Continue'}
            </Button>
          </div>
        )}
      </div>
      <AnimatePresence>
        {activating && (
          <Activation
            key="activation"
            name={activating}
            onDone={() => {
              onDone();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ActivateStep({ draft, onActivate }: { draft: Draft; onActivate: () => void }) {
  const total = diffDays(draft.basics.startDate, draft.basics.targetDate) + 1;
  return (
    <div className="stack gap-6">
      <Panel glow>
        <div className="t-eyebrow">Mission brief</div>
        <div className="t-h2" style={{ marginTop: 8 }}>
          {draft.basics.name}
        </div>
        <div className="divider" />
        <div className="summary">
          <div className="summary__row">
            <span>Window</span>
            <span>{formatRange(draft.basics.startDate, draft.basics.targetDate)}</span>
          </div>
          <div className="summary__row">
            <span>Duration</span>
            <span>{total} days</span>
          </div>
          <div className="summary__row">
            <span>Goals</span>
            <span>{draft.goals.map((g) => GOAL_META[g].label).join(', ')}</span>
          </div>
          <div className="summary__row">
            <span>Training</span>
            <span>{draft.training.weeklyFrequency}× per week</span>
          </div>
          <div className="summary__row">
            <span>Habits</span>
            <span>{draft.habits.length || 'None'}</span>
          </div>
          <div className="summary__row">
            <span>Reminder</span>
            <span>{draft.reminder.enabled ? draft.reminder.time : 'Off'}</span>
          </div>
        </div>
        {draft.basics.motivation && (
          <p className="t-small" style={{ marginTop: 16, fontStyle: 'italic' }}>
            “{draft.basics.motivation}”
          </p>
        )}
      </Panel>
      <HoldToActivate onComplete={onActivate} />
    </div>
  );
}

function HoldToActivate({ onComplete }: { onComplete: () => void }) {
  const progress = useMotionValue(0);
  const dash = useTransform(progress, (v) => v);
  const ringOpacity = useTransform(progress, (v) => (v > 0.002 ? 1 : 0));
  const coreShadow = useTransform(
    progress,
    (v) => `inset 0 0 0 1px rgba(160,245,184,${0.25 + v * 0.5}), 0 0 ${30 + v * 60}px -10px rgba(55,217,120,${0.2 + v * 0.8})`,
  );
  const anim = useRef<ReturnType<typeof animate> | null>(null);
  const done = useRef(false);
  const reduce = prefersReducedMotion();

  const start = () => {
    if (done.current) return;
    vibrate(12);
    anim.current?.stop();
    anim.current = animate(progress, 1, {
      duration: reduce ? 0.3 : 1.3 * (1 - progress.get()),
      ease: 'linear',
      onComplete: () => {
        done.current = true;
        vibrate([20, 30, 60]);
        onComplete();
      },
    });
  };
  const cancel = () => {
    if (done.current) return;
    anim.current?.stop();
    anim.current = animate(progress, 0, { duration: 0.35, ease: [0.22, 1, 0.36, 1] });
  };

  return (
    <div className="stack" style={{ alignItems: 'center', gap: 14 }}>
      <motion.div
        className="hold"
        role="button"
        tabIndex={0}
        aria-label="Press and hold to activate your Lock In"
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && cancel()}
        whileTap={{ scale: 0.96 }}
      >
        <svg viewBox="0 0 184 184">
          <circle cx="92" cy="92" r="86" fill="none" stroke="rgba(160,245,184,0.1)" strokeWidth="4" />
          <motion.circle cx="92" cy="92" r="86" fill="none" stroke="#a0f5b8" strokeWidth="4" strokeLinecap="round" style={{ pathLength: dash, opacity: ringOpacity, filter: 'drop-shadow(0 0 8px rgba(55,217,120,0.8))' }} />
        </svg>
        <motion.div className="hold__core" style={{ boxShadow: coreShadow }}>
          <div>
            LOCK
            <br />
            IN
            <small>HOLD</small>
          </div>
        </motion.div>
      </motion.div>
      <span className="t-small">Press and hold</span>
    </div>
  );
}
