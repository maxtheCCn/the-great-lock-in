import {
  Archive,
  Bell,
  Bot,
  ChevronRight,
  Database,
  Dumbbell,
  LayoutGrid,
  ListChecks,
  Palette,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Block, Page } from '@/components/Page';
import { Badge, Panel } from '@/design/primitives';
import { useArchivedLockIns } from '@/data/hooks';
import { updateSettings, useCoachSettings, useSettings } from '@/data/settings';
import { db, dataMode } from '@/data/db';
import { formatRange } from '@/domain/dates';
import { lockInTimeline } from '@/domain/timeline';
import { useActive } from '@/state/lockin';
import { useNav, type RouteName } from '@/nav/store';
import { toast, useUI } from '@/state/ui';
import { checkForUpdate, formatBuild, useUpdates } from '@/services/updates';
import { viewportGap } from '@/services/viewportHeal';
import { isStandalone } from '@/services/platform';
import { ProgressRing } from '@/design/visuals';

function Row({ icon: Icon, title, sub, value, to, params, onPress }: { icon: LucideIcon; title: string; sub?: string; value?: React.ReactNode; to?: RouteName; params?: Record<string, string>; onPress?: () => void }) {
  const push = useNav((s) => s.push);
  return (
    <button type="button" className="list-row" onClick={() => (onPress ? onPress() : to && push(to, params))}>
      <span className="list-row__icon">
        <Icon />
      </span>
      <span className="stack grow" style={{ minWidth: 0 }}>
        <span className="list-row__title">{title}</span>
        {sub && <span className="list-row__sub">{sub}</span>}
      </span>
      {value && <span className="list-row__value">{value}</span>}
      <span className="list-row__chev">
        <ChevronRight />
      </span>
    </button>
  );
}

function VersionRow() {
  const { needRefresh, checking, apply } = useUpdates();
  const gap = viewportGap();
  const built = `Built ${formatBuild()}${gap ? ` · iOS screen gap ${gap} pt` : ''}. Tap to check for updates.`;
  const sub = checking ? 'Checking for updates…' : needRefresh ? 'A new version is ready. Tap to update.' : built;
  const onPress = async () => {
    if (needRefresh) return apply();
    const result = await checkForUpdate();
    if (result === 'latest') toast('You have the latest version.', { tone: 'success' });
    else if (result === 'unavailable') toast('Updates are checked when TGLI runs from the Home Screen or a browser tab.');
  };
  return <Row icon={RefreshCw} title="App version" sub={sub} value={needRefresh ? <Badge>Update</Badge> : undefined} onPress={() => void onPress()} />;
}

export default function ProfilePage() {
  const lockIn = useActive();
  const settings = useSettings();
  const coach = useCoachSettings();
  const archived = useArchivedLockIns();
  const openSheet = useUI((s) => s.openSheet);
  const checkIns = useLiveQuery(() => db.checkIns.where('lockInId').equals(lockIn.id).count(), [lockIn.id]) ?? 0;
  const t = lockInTimeline(lockIn);
  if (!settings) return null;

  return (
    <Page title="Profile">
      <Block>
        <Panel glow>
          <div className="row gap-4">
            <ProgressRing value={t.elapsed} size={72} stroke={5}>
              <span className="t-mono" style={{ fontSize: 13 }}>
                {Math.round(t.elapsed * 100)}%
              </span>
            </ProgressRing>
            <div className="stack grow" style={{ minWidth: 0 }}>
              <input
                className="input"
                aria-label="Your name (optional)"
                placeholder="Your name (optional)"
                defaultValue={settings.profileName}
                maxLength={30}
                onBlur={(e) => e.target.value !== settings.profileName && updateSettings({ profileName: e.target.value.trim() })}
                style={{ minHeight: 40, padding: '8px 12px', fontWeight: 700, background: 'transparent', boxShadow: 'none', marginLeft: -12 }}
              />
              <span className="t-small" style={{ color: 'var(--text-1)', fontWeight: 650 }}>
                {lockIn.name}
              </span>
              <span className="t-small" style={{ fontSize: 12 }}>
                {checkIns} check-ins so far
              </span>
              <span className="t-small" style={{ fontSize: 12 }}>
                {formatRange(lockIn.startDate, lockIn.targetDate)}
              </span>
            </div>
          </div>
        </Panel>
      </Block>

      <Block>
        <div className="t-eyebrow section-label">Lock In</div>
        <div className="list">
          <Row icon={Target} title="Active Lock In" sub="Name, dates, motivation, goals" to="settingsLockIn" />
          <Row icon={Dumbbell} title="Training preferences" sub="Experience and weekly frequency" to="settingsTraining" value={`${lockIn.weeklyFrequency}×/wk`} />
          <Row icon={ListChecks} title="Daily habits" sub="What appears in your check-in" to="settingsHabits" value={lockIn.habits.length || undefined} />
          <Row icon={Archive} title="Lock In archive" sub="Completed Lock Ins & replays" to="archive" value={archived?.length || undefined} />
        </div>
      </Block>

      <Block>
        <div className="t-eyebrow section-label">Experience</div>
        <div className="list">
          <Row icon={Bell} title="Reminder" sub="Daily check-in nudge" to="settingsReminders" value={settings.reminder.enabled ? settings.reminder.time : 'Off'} />
          <Row icon={LayoutGrid} title="Dashboard" sub="Widgets, order and statistics" onPress={() => openSheet({ type: 'dashboard' })} />
          <Row icon={Palette} title="Appearance & units" sub="Visual effects, measurement units" to="settingsAppearance" value={settings.units === 'metric' ? 'cm/kg' : 'in/lb'} />
          {!isStandalone() && <Row icon={Smartphone} title="Install on iPhone" sub="Add TGLI to your Home Screen" to="install" />}
        </div>
      </Block>

      <Block>
        <div className="t-eyebrow section-label">TGLI Coach · optional</div>
        <div className="list">
          <Row icon={Bot} title="Coach & AI provider" sub="API key, chat history, memory" to="settingsCoach" value={coach?.provider ? <Badge>On</Badge> : 'Not set'} />
        </div>
      </Block>

      <Block>
        <div className="t-eyebrow section-label">Privacy & data</div>
        <div className="list">
          <Row icon={ShieldCheck} title="Privacy" sub="Photo blur, what's stored where" to="settingsPrivacy" />
          <Row icon={Database} title="Data" sub="Export, import, delete, demo mode" to="settingsData" value={dataMode === 'demo' ? <Badge tone="warn">Demo</Badge> : undefined} />
        </div>
      </Block>

      <Block>
        <div className="t-eyebrow section-label">App</div>
        <div className="list">
          <VersionRow />
        </div>
      </Block>

      <Block>
        <p className="t-small" style={{ textAlign: 'center', fontSize: 12, marginTop: 8 }}>
          The Great Lock In · v0.1 · No social features, no tracking, no account.
        </p>
      </Block>
    </Page>
  );
}
