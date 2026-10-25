import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AmbientBackground } from '@/components/Ambient';
import { TabBar } from '@/components/TabBar';
import { ConfirmHost, ToastHost } from '@/design/Overlays';
import { Navigator } from '@/nav/Navigator';
import { installHistorySync } from '@/nav/store';
import { useActiveLockIn } from '@/data/hooks';
import { getSettings, useSettings } from '@/data/settings';
import { db, dataMode } from '@/data/db';
import { LockInContext } from '@/state/lockin';
import { useUI, toast } from '@/state/ui';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { CheckInSheet } from '@/features/checkin/CheckInSheet';
import { DashboardEditor } from '@/features/home/DashboardEditor';
import { GlobalSheets } from '@/features/GlobalSheets';
import { CelebrationHost } from '@/features/motivation/Celebration';
import { startReminderLoop } from '@/services/reminders';
import { todayISO } from '@/domain/dates';

function useEffectsAttribute() {
  const settings = useSettings();
  useEffect(() => {
    if (settings) document.documentElement.dataset.effects = settings.effects;
  }, [settings?.effects]); // eslint-disable-line react-hooks/exhaustive-deps
  return settings?.effects ?? 'full';
}

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (e) => console.warn('SW registration failed', e),
  });
  useEffect(() => {
    if (needRefresh) toast('A new version of TGLI is ready.', { action: { label: 'Reload', run: () => updateServiceWorker(true) } });
  }, [needRefresh, updateServiceWorker]);
  return null;
}

function ReminderLoop({ lockInId }: { lockInId: string }) {
  useEffect(
    () =>
      startReminderLoop(async () => {
        const s = await getSettings();
        const today = todayISO();
        const done = await db.checkIns.where('[lockInId+date]').equals([lockInId, today]).count();
        return { enabled: s.reminder.enabled, time: s.reminder.time, checkedInToday: done > 0, today };
      }),
    [lockInId],
  );
  return null;
}

export default function App() {
  const effects = useEffectsAttribute();
  const settings = useSettings();
  const lockIn = useActiveLockIn();
  const sheet = useUI((s) => s.sheet);
  const closeSheet = useUI((s) => s.closeSheet);

  useEffect(() => installHistorySync(), []);

  const loading = settings === undefined || lockIn === undefined;
  const needsOnboarding = !loading && (!settings.onboarded || !lockIn);
  // Keep onboarding mounted until its activation sequence finishes, even though
  // the new Lock In already exists in the database.
  const [onboarding, setOnboarding] = useState<null | 'first' | 'new'>(null);
  useEffect(() => {
    if (needsOnboarding && !onboarding) setOnboarding(settings.onboarded ? 'new' : 'first');
  }, [needsOnboarding, onboarding, settings?.onboarded]);
  const showOnboarding = needsOnboarding || onboarding !== null;

  return (
    <MotionConfig reducedMotion={effects === 'minimal' ? 'always' : 'user'}>
      <AmbientBackground />
      <UpdatePrompt />
      <AnimatePresence mode="wait">
        {loading ? null : showOnboarding ? (
          <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <Onboarding mode={onboarding ?? (settings.onboarded ? 'new' : 'first')} onDone={() => setOnboarding(null)} />
          </motion.div>
        ) : (
          lockIn && (
            <motion.div key={`shell-${lockIn.id}`} className="app" initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
              <LockInContext.Provider value={lockIn}>
                <div className="app__viewport">
                  <Navigator />
                </div>
                <TabBar badges={dataMode === 'demo' ? { profile: true } : undefined} />
                <CheckInSheet lockIn={lockIn} />
                <DashboardEditor open={sheet?.type === 'dashboard'} onClose={closeSheet} />
                <GlobalSheets lockIn={lockIn} />
                <CelebrationHost lockInId={lockIn.id} />
                <ReminderLoop lockInId={lockIn.id} />
              </LockInContext.Provider>
            </motion.div>
          )
        )}
      </AnimatePresence>
      <ToastHost />
      <ConfirmHost />
    </MotionConfig>
  );
}
