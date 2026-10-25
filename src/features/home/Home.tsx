import { motion } from 'motion/react';
import { Archive, Film, SlidersHorizontal, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Block, Page } from '@/components/Page';
import { Badge, Button, IconButton, Panel } from '@/design/primitives';
import { useCheckIns, useGoals, useMilestoneRecords, useTraining } from '@/data/hooks';
import { updateSettings, useSettings } from '@/data/settings';
import { db, dataMode } from '@/data/db';
import type { LockIn, WidgetId } from '@/data/types';
import { lockInTimeline } from '@/domain/timeline';
import { useNow, useToday } from '@/hooks/useNow';
import { useUI } from '@/state/ui';
import { go } from '@/nav/store';
import { isIOS, isStandalone } from '@/services/platform';
import { Orbit } from './Orbit';
import {
  CheckinWidget,
  GoalsWidget,
  HabitsWidget,
  JournalWidget,
  MilestonesWidget,
  MusclesWidget,
  PulseWidget,
  ReviewWidget,
  StatsWidget,
  type HomeData,
} from './widgets';
import './home.css';

const WIDGETS: Record<WidgetId, (p: { d: HomeData }) => React.ReactElement> = {
  checkin: CheckinWidget,
  stats: StatsWidget,
  pulse: PulseWidget,
  habits: HabitsWidget,
  goals: GoalsWidget,
  milestones: MilestonesWidget,
  review: ReviewWidget,
  muscles: MusclesWidget,
  journal: JournalWidget,
};

function greeting(h: number) {
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Home({ lockIn }: { lockIn: LockIn }) {
  const settings = useSettings();
  const today = useToday();
  const now = useNow(60_000);
  const checkIns = useCheckIns(lockIn.id);
  const training = useTraining(lockIn.id);
  const milestones = useMilestoneRecords(lockIn.id);
  const goals = useGoals(lockIn.id);
  const journalToday = useLiveQuery(() => db.journal.where('lockInId').equals(lockIn.id).filter((j) => j.date === today).count(), [lockIn.id, today]);
  const openSheet = useUI((s) => s.openSheet);
  const timeline = lockInTimeline(lockIn, now);

  const data: HomeData | null = useMemo(
    () => (settings ? { lockIn, checkIns, training, milestones, goals, journalToday: !!journalToday, today, timeline, settings } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, lockIn, checkIns, training, milestones, goals, journalToday, today, timeline.phase, timeline.daysRemaining],
  );

  if (!settings || !data) return null;
  const { order, hidden } = settings.dashboard;
  const visible = order.filter((w) => !hidden.includes(w));
  const showInstall = isIOS() && !isStandalone() && !settings.installHintDismissed;
  const name = settings.profileName.trim();

  return (
    <Page
      title={lockIn.name}
      eyebrow={
        <span className="row gap-2">
          {dataMode === 'demo' && (
            <button type="button" onClick={() => go('profile', 'settingsData')} style={{ marginRight: 4 }}>
              <Badge tone="warn">Demo data</Badge>
            </button>
          )}
          {timeline.phase === 'active' && <span className="dot-live" />}
          {timeline.phase === 'active' ? `Day ${timeline.dayNumber} of ${timeline.totalDays}` : timeline.phase === 'upcoming' ? `Starts in ${timeline.startsIn} days` : 'Target reached'}
        </span>
      }
      subtitle={`${greeting(now.getHours())}${name ? `, ${name}` : ''}.`}
      heroRight={
        <IconButton label="Customize dashboard" onClick={() => openSheet({ type: 'dashboard' })}>
          <SlidersHorizontal />
        </IconButton>
      }
    >
      <Block>
        <Orbit lockIn={lockIn} checkIns={checkIns} today={today} />
      </Block>

      {timeline.phase === 'ended' && (
        <Block>
          <Panel glow eyebrow="Mission complete">
            <div className="t-h2">You made it to the target date.</div>
            <p className="t-small" style={{ margin: '8px 0 16px' }}>
              Watch your Transformation Replay, then archive this Lock In to start a new one. Everything is preserved.
            </p>
            <div className="grid-2">
              <Button variant="secondary" icon={<Film />} onClick={() => go('profile', 'archived', { id: lockIn.id, replay: '1' })}>
                Replay
              </Button>
              <Button icon={<Archive />} onClick={() => go('profile', 'settingsLockIn', { complete: '1' })}>
                Finish
              </Button>
            </div>
          </Panel>
        </Block>
      )}

      {showInstall && (
        <Block>
          <Panel tight>
            <div className="install-card">
              <span className="install-card__icon" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}apple-touch-icon-180x180.png)` }} />
              <div className="stack grow">
                <span className="t-h3" style={{ fontSize: 15 }}>
                  Install TGLI on your iPhone
                </span>
                <span className="t-small">Full-screen, offline and on your Home Screen.</span>
              </div>
              <Button size="sm" onClick={() => go('profile', 'install')}>
                How
              </Button>
              <IconButton label="Dismiss" size="sm" variant="plain" onClick={() => updateSettings({ installHintDismissed: true })}>
                <X />
              </IconButton>
            </div>
          </Panel>
        </Block>
      )}

      {visible.map((w) => {
        const W = WIDGETS[w];
        return (
          <Block key={w}>
            <W d={data} />
          </Block>
        );
      })}

      {visible.length === 0 && (
        <Block>
          <Panel>
            <div className="row between">
              <span className="t-small">All widgets are hidden.</span>
              <Button size="sm" variant="secondary" onClick={() => openSheet({ type: 'dashboard' })}>
                Customize
              </Button>
            </div>
          </Panel>
        </Block>
      )}

      <motion.div className="row" style={{ justifyContent: 'center', marginTop: 8 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
        <Badge tone="muted">Stored privately on this device</Badge>
      </motion.div>
    </Page>
  );
}
