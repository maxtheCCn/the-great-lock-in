import { motion } from 'motion/react';
import { BellRing, Database, Download, EyeOff, FileUp, HardDrive, Lock, ShieldCheck, Sparkles, Trash, TriangleAlert, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Block, Page } from '@/components/Page';
import { Badge, Button, Field, Panel, Segmented, Toggle } from '@/design/primitives';
import { confirmAction } from '@/design/Overlays';
import { completeLockIn, updateLockIn } from '@/data/repo';
import { updateSettings, useSettings } from '@/data/settings';
import { dataMode, db, requestPersistence, setDataMode } from '@/data/db';
import type { EffectsLevel } from '@/data/types';
import { useActive } from '@/state/lockin';
import { toast } from '@/state/ui';
import { BasicsEditor, GoalsEditor, HabitsEditor, ReminderEditor, TrainingEditor, basicsError, type BasicsValue, type TrainingValue } from '@/features/onboarding/editors';
import { deleteEverything, exportBackup, fmtBytes, readBackup, restoreBackup, storageInfo } from '@/services/backup';
import { notificationSupport } from '@/services/reminders';
import { goBack } from '@/nav/store';

/* ── Active Lock In ──────────────────────────────────────── */

export function LockInSettings({ params }: { params: Record<string, string> }) {
  const lockIn = useActive();
  const [basics, setBasics] = useState<BasicsValue>({ name: lockIn.name, startDate: lockIn.startDate, targetDate: lockIn.targetDate, motivation: lockIn.motivation });
  const [goals, setGoals] = useState(lockIn.goals);
  const [saving, setSaving] = useState(false);
  const dangerRef = useRef<HTMLDivElement>(null);
  const err = basicsError(basics) ?? (goals.length ? null : 'Choose at least one goal.');

  useEffect(() => {
    if (params.complete) setTimeout(() => dangerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
  }, [params.complete]);

  const save = async () => {
    setSaving(true);
    await updateLockIn(lockIn.id, { name: basics.name.trim(), startDate: basics.startDate, targetDate: basics.targetDate, motivation: basics.motivation.trim(), goals });
    setSaving(false);
    toast('Lock In updated', { tone: 'success' });
  };

  const complete = async () => {
    const ok = await confirmAction({
      title: 'Complete this Lock In?',
      message: 'It moves to your archive with everything preserved: check-ins, photos, measurements, reviews and journal. You can then start a new one.',
      confirmLabel: 'Complete',
    });
    if (ok) await completeLockIn(lockIn.id);
  };

  return (
    <Page title="Active Lock In" backLabel="Profile">
      <Block>
        <BasicsEditor value={basics} onChange={setBasics} showIdeas={false} />
      </Block>
      <Block>
        <Field label="Goals">
          <GoalsEditor value={goals} onChange={setGoals} />
        </Field>
      </Block>
      <Block>
        <Button block size="lg" disabled={!!err} loading={saving} onClick={save}>
          {err ?? 'Save changes'}
        </Button>
      </Block>
      <Block>
        <div ref={dangerRef}>
          <Panel eyebrow="Finish" title="Complete Lock In">
            <p className="t-small" style={{ marginBottom: 14 }}>
              Only one Lock In can be active. Completing archives this one and unlocks the Transformation Replay.
            </p>
            <Button variant="secondary" block onClick={complete}>
              Complete & archive
            </Button>
          </Panel>
        </div>
      </Block>
    </Page>
  );
}

/* ── Training ────────────────────────────────────────────── */

export function TrainingSettings() {
  const lockIn = useActive();
  const settings = useSettings();
  const [value, setValue] = useState<TrainingValue | null>(null);
  useEffect(() => {
    if (settings && !value) setValue({ experience: lockIn.experience, weeklyFrequency: lockIn.weeklyFrequency, preferences: lockIn.preferences, ageGroup: settings.ageGroup });
  }, [settings, value, lockIn]);
  if (!value) return null;
  const save = async () => {
    await updateLockIn(lockIn.id, { experience: value.experience, weeklyFrequency: value.weeklyFrequency, preferences: value.preferences });
    const youth = value.ageGroup === 'under16' || value.ageGroup === '16to17';
    await updateSettings({ ageGroup: value.ageGroup, ...(youth ? { showSupplements: false } : {}) });
    toast('Training preferences saved', { tone: 'success' });
    goBack();
  };
  return (
    <Page title="Training" backLabel="Profile">
      <Block>
        <TrainingEditor value={value} onChange={setValue} />
      </Block>
      <Block>
        <Button block size="lg" onClick={save}>
          Save
        </Button>
      </Block>
    </Page>
  );
}

/* ── Habits ──────────────────────────────────────────────── */

export function HabitSettings() {
  const lockIn = useActive();
  const [habits, setHabits] = useState(lockIn.habits);
  const save = async () => {
    await updateLockIn(lockIn.id, { habits });
    toast('Habits updated', { tone: 'success' });
    goBack();
  };
  return (
    <Page title="Daily habits" subtitle="Removing a habit keeps its past history in your check-ins." backLabel="Profile">
      <Block>
        <HabitsEditor value={habits} onChange={setHabits} />
      </Block>
      <Block>
        <Button block size="lg" onClick={save}>
          Save habits
        </Button>
      </Block>
    </Page>
  );
}

/* ── Reminders ───────────────────────────────────────────── */

export function ReminderSettings() {
  const settings = useSettings();
  if (!settings) return null;
  const test = async () => {
    if (notificationSupport() !== 'granted') {
      toast('Allow notifications first.', { tone: 'error' });
      return;
    }
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body: 'This is how your daily reminder will look.', icon: `${import.meta.env.BASE_URL}pwa-192x192.png`, tag: 'tgli-test' };
    if (reg) await reg.showNotification('TGLI reminder', opts);
    else new Notification('TGLI reminder', opts);
  };
  return (
    <Page title="Reminder" backLabel="Profile">
      <Block>
        <ReminderEditor enabled={settings.reminder.enabled} time={settings.reminder.time} onChange={(reminder) => updateSettings({ reminder })} />
      </Block>
      {settings.reminder.enabled && (
        <Block>
          <Button variant="secondary" block icon={<BellRing />} onClick={test}>
            Send a test notification
          </Button>
        </Block>
      )}
    </Page>
  );
}

/* ── Appearance & units ──────────────────────────────────── */

const EFFECTS: { value: EffectsLevel; label: string; desc: string }[] = [
  { value: 'full', label: 'Full', desc: 'Ambient motion, particles, glow and cinematic transitions.' },
  { value: 'reduced', label: 'Reduced', desc: 'Keeps transitions, removes ambient motion and particles. Lighter on battery.' },
  { value: 'minimal', label: 'Minimal', desc: 'Near-instant changes, no decorative animation.' },
];

export function AppearanceSettings() {
  const settings = useSettings();
  if (!settings) return null;
  const youth = settings.ageGroup === 'under16' || settings.ageGroup === '16to17';
  return (
    <Page title="Appearance" backLabel="Profile">
      <Block>
        <Field label="Visual effects">
          <Segmented<EffectsLevel> value={settings.effects} onChange={(effects) => updateSettings({ effects })} options={EFFECTS.map((e) => ({ value: e.value, label: e.label }))} />
          <p className="t-small" style={{ marginTop: 6 }}>
            {EFFECTS.find((e) => e.value === settings.effects)?.desc} Your device's reduce-motion setting is always respected.
          </p>
        </Field>
      </Block>
      <Block>
        <Field label="Units">
          <Segmented
            value={settings.units}
            onChange={(units) => updateSettings({ units })}
            options={[
              { value: 'metric', label: 'Metric · cm, kg' },
              { value: 'imperial', label: 'Imperial · in, lb' },
            ]}
          />
        </Field>
      </Block>
      <Block>
        <Panel tight>
          <div className="row gap-3">
            <div className="stack grow">
              <span className="t-h3" style={{ fontSize: 15 }}>
                Supplement fields in check-in
              </span>
              <span className="t-small">{youth ? 'Turned off for under-18 profiles.' : 'Optional creatine & protein yes/no. Personal log only.'}</span>
            </div>
            <Toggle label="Supplement fields" checked={settings.showSupplements && !youth} disabled={youth} onChange={(showSupplements) => updateSettings({ showSupplements })} />
          </div>
        </Panel>
      </Block>
    </Page>
  );
}

/* ── Privacy ─────────────────────────────────────────────── */

export function PrivacySettings() {
  const settings = useSettings();
  const [info, setInfo] = useState<Awaited<ReturnType<typeof storageInfo>> | null>(null);
  useEffect(() => {
    storageInfo().then(setInfo);
  }, []);
  if (!settings) return null;
  return (
    <Page title="Privacy" subtitle="TGLI is private by design: no accounts, no social features, no analytics." backLabel="Profile">
      <Block>
        <Panel tight>
          <div className="row gap-3">
            <span className="list-row__icon">
              <EyeOff />
            </span>
            <div className="stack grow">
              <span className="t-h3" style={{ fontSize: 15 }}>
                Blur progress photos
              </span>
              <span className="t-small">Photos stay blurred until you tap them. Handy in public.</span>
            </div>
            <Toggle label="Blur photos" checked={settings.photoBlur} onChange={(photoBlur) => updateSettings({ photoBlur })} />
          </div>
        </Panel>
      </Block>
      <Block>
        <Panel eyebrow="Where your data lives">
          <div className="stack gap-3 t-small">
            <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
              <HardDrive size={16} color="var(--mint)" style={{ flex: 'none', marginTop: 3 }} />
              <span>Everything you record, including check-ins, photos, measurements, journal and coach chats, is stored in this browser's private storage on this device only.</span>
            </div>
            <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
              <TriangleAlert size={16} color="var(--warn)" style={{ flex: 'none', marginTop: 3 }} />
              <span>
                That is not a cloud backup. Clearing website data, deleting the Home Screen app or losing the device can erase it. Export a backup regularly from <b>Data</b>.
              </span>
            </div>
            <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
              <Sparkles size={16} color="var(--mint)" style={{ flex: 'none', marginTop: 3 }} />
              <span>The optional coach only sends data you allow, directly to the AI provider you chose. Photos are never sent.</span>
            </div>
          </div>
        </Panel>
      </Block>
      <Block>
        <Panel eyebrow="Storage">
          <div className="grid-2">
            <div className="kv">
              <span className="kv__value" style={{ fontSize: 17 }}>
                {fmtBytes(info?.usage ?? null)}
              </span>
              <span className="kv__label">Used by TGLI</span>
            </div>
            <div className="kv">
              <span className="kv__value" style={{ fontSize: 17 }}>
                {info?.persisted === null || !info ? 'Unknown' : info.persisted ? 'Protected' : 'Best effort'}
              </span>
              <span className="kv__label">Eviction protection</span>
            </div>
          </div>
          {info && info.persisted === false && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Lock />}
              style={{ marginTop: 14 }}
              onClick={async () => {
                const ok = await requestPersistence();
                toast(ok ? 'Storage protection granted' : 'The browser declined. Installing TGLI to the Home Screen usually helps.', { tone: ok ? 'success' : 'default' });
                setInfo(await storageInfo());
              }}
            >
              Request protection
            </Button>
          )}
        </Panel>
      </Block>
    </Page>
  );
}

/* ── Data ────────────────────────────────────────────────── */

export function DataSettings() {
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async (photos: boolean) => {
    setBusy(photos ? 'export-photos' : 'export');
    try {
      const how = await exportBackup(photos);
      toast(how === 'downloaded' ? 'Backup downloaded' : 'Backup ready', { tone: 'success' });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', { tone: 'error' });
    }
    setBusy(null);
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = await readBackup(file);
      const ok = await confirmAction({
        title: 'Replace all data?',
        message: `This replaces everything on this device with the backup from ${new Date(backup.exportedAt).toLocaleDateString()}${backup.includesPhotos ? '' : ' (no photos included)'}.`,
        confirmLabel: 'Replace',
        tone: 'danger',
      });
      if (!ok) return;
      setBusy('import');
      await restoreBackup(backup);
      toast('Backup restored', { tone: 'success' });
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', { tone: 'error' });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearTable = async (label: string, run: () => Promise<unknown>) => {
    if (!(await confirmAction({ title: `Delete all ${label}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    await run();
    toast(`${label[0].toUpperCase()}${label.slice(1)} deleted`);
  };

  const wipe = async () => {
    const ok = await confirmAction({
      title: dataMode === 'demo' ? 'Reset demo data?' : 'Delete everything?',
      message: dataMode === 'demo' ? 'The demo database is rebuilt on reload.' : 'All Lock Ins, check-ins, photos, measurements, journal entries, coach chats and settings on this device will be permanently erased.',
      confirmLabel: 'Delete everything',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteEverything();
    location.reload();
  };

  const toggleDemo = async () => {
    if (dataMode === 'real') {
      const ok = await confirmAction({
        title: 'Explore demo mode?',
        message: 'TGLI switches to a separate database filled with clearly labelled sample data. Your real data is untouched and comes back when you exit.',
        confirmLabel: 'Open demo',
      });
      if (!ok) return;
      setDataMode('demo');
    } else {
      setDataMode('real');
    }
    location.reload();
  };

  return (
    <Page title="Data" subtitle="Your data, your device. Export, restore or erase at any time." backLabel="Profile">
      <Block>
        <div className="t-eyebrow section-label" style={{ marginTop: 0 }}>
          Backup
        </div>
        <div className="list">
          <button className="list-row" onClick={() => doExport(false)} disabled={!!busy}>
            <span className="list-row__icon">
              <Download />
            </span>
            <span className="stack grow">
              <span className="list-row__title">Export data</span>
              <span className="list-row__sub">JSON file, without photos · small</span>
            </span>
            {busy === 'export' && <span className="btn__spinner" />}
          </button>
          <button className="list-row" onClick={() => doExport(true)} disabled={!!busy}>
            <span className="list-row__icon">
              <Upload />
            </span>
            <span className="stack grow">
              <span className="list-row__title">Export with photos</span>
              <span className="list-row__sub">Complete backup · can be large</span>
            </span>
            {busy === 'export-photos' && <span className="btn__spinner" />}
          </button>
          <label className="list-row" style={{ cursor: 'pointer' }}>
            <span className="list-row__icon">
              <FileUp />
            </span>
            <span className="stack grow">
              <span className="list-row__title">Restore from backup</span>
              <span className="list-row__sub">Replaces data on this device</span>
            </span>
            {busy === 'import' && <span className="btn__spinner" />}
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => doImport(e.target.files?.[0])} />
          </label>
        </div>
        <p className="t-small" style={{ fontSize: 12, marginTop: 10 }}>
          Exports never include your AI API key. Keep backup files somewhere private. They contain your journal and, optionally, photos.
        </p>
      </Block>

      <Block>
        <div className="t-eyebrow section-label">Demo</div>
        <Panel tight>
          <div className="row gap-3">
            <span className="list-row__icon">
              <Database />
            </span>
            <div className="stack grow">
              <span className="t-h3" style={{ fontSize: 15 }}>
                Demo mode {dataMode === 'demo' && <Badge tone="warn">On</Badge>}
              </span>
              <span className="t-small">Explore TGLI with labelled sample data in a separate database.</span>
            </div>
            <Toggle label="Demo mode" checked={dataMode === 'demo'} onChange={toggleDemo} />
          </div>
        </Panel>
      </Block>

      <Block>
        <div className="t-eyebrow section-label">Delete</div>
        <div className="list">
          {(
            [
              ['progress photos', () => db.transaction('rw', db.photos, db.photoBlobs, db.comparisons, () => Promise.all([db.photos.clear(), db.photoBlobs.clear(), db.comparisons.clear()]))],
              ['body measurements', () => db.measurements.clear()],
              ['journal entries', () => db.journal.clear()],
              ['coach chats', () => db.chats.clear()],
              ['coach memories', () => db.memories.clear()],
            ] as [string, () => Promise<unknown>][]
          ).map(([label, run]) => (
            <button key={label} className="list-row" onClick={() => clearTable(label, run)}>
              <span className="list-row__icon list-row__icon--danger">
                <Trash />
              </span>
              <span className="list-row__title grow" style={{ textTransform: 'capitalize' }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </Block>

      <Block>
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button variant="danger" block icon={<ShieldCheck />} onClick={wipe}>
            {dataMode === 'demo' ? 'Reset demo data' : 'Delete everything on this device'}
          </Button>
        </motion.div>
      </Block>
    </Page>
  );
}
