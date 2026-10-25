import { motion } from 'motion/react';
import { useMemo, type ReactNode } from 'react';
import { Block, Page } from '@/components/Page';
import { Panel } from '@/design/primitives';
import { Sparkline } from '@/design/charts';
import { ProgressRing } from '@/design/visuals';
import { Emblem } from '@/components/Emblem';
import { RATING_COLOR, UNRATED_COLOR } from '@/components/ratings';
import { useCheckIns, useGoals, useJournal, useMeasurements, useMilestoneRecords, usePhotos, useTraining } from '@/data/hooks';
import { useSettings } from '@/data/settings';
import { MUSCLES } from '@/data/training/muscles';
import { addDays, eachDay, formatShort, maxDate, minDate, startOfWeek } from '@/domain/dates';
import { muscleVolume, sleepSeries, sleepStats, totalSets, trainingSummary, weeklyVolume } from '@/domain/analytics';
import { goalProgress } from '@/domain/goals';
import { MILESTONES } from '@/domain/milestones';
import { lengthUnit, measurementLabel, toDisplayLength } from '@/domain/measurements';
import { useToday } from '@/hooks/useNow';
import { useActive } from '@/state/lockin';
import { useNav, type RouteName } from '@/nav/store';
import { imageUrl } from '@/services/images';
import { BodyMap2D } from './muscle/BodyMap2D';
import './progress.css';

const GROUP_COLOR = { push: '#a8f5c0', pull: '#37d978', legs: '#1a9e52', core: '#5fae84' } as const;

function HubCard({ title, stat, sub, visual, to, wide, bg }: { title: string; stat?: ReactNode; sub?: ReactNode; visual?: ReactNode; to: RouteName; wide?: boolean; bg?: string }) {
  const push = useNav((s) => s.push);
  return (
    <motion.button type="button" className={`hub-card ${wide ? 'hub-card--wide' : ''} ${bg ? 'hub-card--image' : ''}`} onClick={() => push(to)} whileTap={{ scale: 0.975 }}>
      {bg && <span className="hub-card__bg" style={{ backgroundImage: `url(${bg})` }} aria-hidden />}
      <span className="hub-card__title">{title}</span>
      {visual && <span className="hub-card__visual">{visual}</span>}
      <span className="stack">
        {stat !== undefined && <span className="hub-card__stat">{stat}</span>}
        {sub && <span className="hub-card__sub">{sub}</span>}
      </span>
    </motion.button>
  );
}

const Unit = ({ children }: { children: ReactNode }) => <small>{children}</small>;

export default function ProgressHub() {
  const lockIn = useActive();
  const today = useToday();
  const settings = useSettings();
  const push = useNav((s) => s.push);
  const checkIns = useCheckIns(lockIn.id);
  const training = useTraining(lockIn.id);
  const measurements = useMeasurements(lockIn.id);
  const photos = usePhotos(lockIn.id) ?? [];
  const milestones = useMilestoneRecords(lockIn.id);
  const goals = useGoals(lockIn.id);
  const journal = useJournal(lockIn.id);

  const end = minDate(today, lockIn.targetDate);
  const full = { start: lockIn.startDate, end };
  const week = { start: startOfWeek(today), end: today };
  const last30 = { start: maxDate(addDays(end, -29), lockIn.startDate), end };
  const vol = useMemo(() => muscleVolume(training, last30), [training, last30.start, last30.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekVol = useMemo(() => muscleVolume(training, week), [training, week.start, week.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const sleep = sleepStats(checkIns, full);
  const t = trainingSummary(checkIns, training, full);
  const weekSets = totalSets(training, week);
  const trained = Object.values(vol).filter((v) => v.sets > 0).length;
  const weeks = weeklyVolume(training, checkIns, full).slice(-8);
  const maxSessions = Math.max(lockIn.weeklyFrequency, ...weeks.map((w) => w.sessions), 1);
  const nights = sleepSeries(checkIns, { start: maxDate(addDays(end, -20), lockIn.startDate), end }).map((p) => p.value);
  const groups = (['push', 'pull', 'legs', 'core'] as const).map((g) => ({ g, sets: MUSCLES.filter((m) => m.group === g).reduce((a, m) => a + weekVol[m.id].sets, 0) }));

  const lastWeekStart = addDays(startOfWeek(today), -7);
  const reviewWeek = lastWeekStart >= startOfWeek(lockIn.startDate) ? lastWeekStart : startOfWeek(today);
  const byDate = new Map(checkIns.map((c) => [c.date, c]));

  const topKind = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of measurements) counts.set(m.kind, (counts.get(m.kind) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [measurements]);
  const kindRows = measurements.filter((m) => m.kind === topKind).sort((a, b) => a.date.localeCompare(b.date));
  const units = settings?.units ?? 'metric';
  const latestPhoto = photos[photos.length - 1];
  const firstPhoto = photos[0];
  const blur = settings?.photoBlur;
  const active = goals.filter((g) => g.status === 'active');
  const lastEntry = journal[0];

  return (
    <Page title="Progress" subtitle="Everything here comes from what you recorded. Missing data stays missing.">
      <Block>
        <Panel glow onPress={() => push('muscles')}>
          <div className="muscle-hero">
            <div className="muscle-hero__figs">
              <BodyMap2D volume={vol} side="front" height={156} />
              <BodyMap2D volume={vol} side="back" height={156} />
            </div>
            <div className="stack gap-2">
              <span className="t-h3">Muscle map</span>
              <span className="t-num" style={{ fontSize: 34, lineHeight: 1 }}>
                {trained}
                <span className="t-small" style={{ fontFamily: 'var(--font-body)', marginLeft: 6, letterSpacing: 0 }}>
                  of 14
                </span>
              </span>
              <span className="t-small">muscle groups trained in the last 30 days.</span>
              <span className="t-small" style={{ color: 'var(--mint)', fontWeight: 700, marginTop: 2 }}>
                Explore in 3D
              </span>
            </div>
          </div>
        </Panel>
      </Block>

      <Block>
        <h2 className="hub-section">Training</h2>
        <div className="hub-grid">
          <HubCard
            title="Balance"
            to="balance"
            stat={
              <>
                {weekSets}
                <Unit>sets this week</Unit>
              </>
            }
            visual={
              <span className="hub-split" aria-hidden>
                {weekSets > 0 ? groups.map((g) => (g.sets ? <i key={g.g} style={{ flex: g.sets, background: GROUP_COLOR[g.g] }} /> : null)) : <i style={{ flex: 1, background: 'rgba(160,245,184,0.08)' }} />}
              </span>
            }
          />
          <HubCard
            title="Workouts"
            to="workouts"
            stat={
              <>
                {t.sessions}
                <Unit>sessions</Unit>
              </>
            }
            visual={
              <span className="hub-bars" aria-hidden>
                {weeks.map((w) => (
                  <i key={w.key} style={{ height: `${Math.max(6, (w.sessions / maxSessions) * 100)}%`, opacity: w.key === startOfWeek(today) ? 1 : 0.55 }} />
                ))}
              </span>
            }
          />
        </div>
      </Block>

      <Block>
        <h2 className="hub-section">Recovery</h2>
        <div className="hub-grid">
          <HubCard
            wide
            title="Sleep"
            to="sleep"
            stat={
              sleep.avg === null ? (
                'No nights yet'
              ) : (
                <>
                  {sleep.avg.toFixed(1)}
                  <Unit>h average</Unit>
                </>
              )
            }
            sub={`${sleep.nights} nights recorded`}
            visual={<Sparkline values={nights} width={300} height={40} fluid />}
          />
          <HubCard
            title="Weekly review"
            to="reviews"
            sub={`Week of ${formatShort(reviewWeek)}`}
            visual={
              <span className="hub-week" aria-hidden>
                {eachDay(reviewWeek, addDays(reviewWeek, 6)).map((d) => {
                  const c = byDate.get(d);
                  return <i key={d} style={{ background: c?.rating ? RATING_COLOR[c.rating] : c ? 'rgba(160,245,184,0.4)' : UNRATED_COLOR }} />;
                })}
              </span>
            }
          />
          <HubCard
            title="Milestones"
            to="milestones"
            sub={`${milestones.length} of ${MILESTONES.length} earned`}
            visual={
              <span className="row" style={{ gap: 4 }}>
                {[...milestones]
                  .sort((a, b) => b.achievedAt - a.achievedAt)
                  .slice(0, 3)
                  .map((m) => (
                    <Emblem key={m.id} milestoneKey={m.key} size={34} />
                  ))}
                {milestones.length === 0 && <Emblem milestoneKey="first-checkin" size={34} locked />}
              </span>
            }
          />
        </div>
      </Block>

      <Block>
        <h2 className="hub-section">Body</h2>
        <div className="hub-grid">
          <HubCard
            title="Photos"
            to="photos"
            bg={latestPhoto && !blur ? imageUrl(`thumb:${latestPhoto.id}`, latestPhoto.thumb) : undefined}
            stat={photos.length ? photos.length : undefined}
            sub={photos.length ? `Latest ${formatShort(latestPhoto.date)}` : 'Private and optional'}
          />
          <HubCard
            title={topKind ? measurementLabel(topKind, settings?.customMeasurements) : 'Measurements'}
            to="measurements"
            stat={
              kindRows.length ? (
                <>
                  {toDisplayLength(kindRows[kindRows.length - 1].valueCm, units).toFixed(1)}
                  <Unit>{lengthUnit(units)}</Unit>
                </>
              ) : undefined
            }
            sub={measurements.length ? `${measurements.length} entries` : 'Entirely optional'}
            visual={kindRows.length > 1 ? <Sparkline values={kindRows.map((r) => r.valueCm)} width={120} height={30} fluid /> : undefined}
          />
          {photos.length >= 2 ? (
            <HubCard
              wide
              title="Transformation Studio"
              to="studio"
              sub={`${formatShort(firstPhoto.date)} to ${formatShort(latestPhoto.date)}`}
              visual={
                <span className="hub-pair" aria-hidden>
                  {[firstPhoto, latestPhoto].map((p) => (
                    <img key={p.id} src={imageUrl(`thumb:${p.id}`, p.thumb)} alt="" style={{ filter: blur ? 'blur(14px)' : undefined }} />
                  ))}
                </span>
              }
            />
          ) : (
            <HubCard wide title="Transformation Studio" to="studio" sub="Add two photos to compare before and after." />
          )}
        </div>
      </Block>

      <Block>
        <h2 className="hub-section">Motivation</h2>
        <div className="hub-grid">
          <HubCard
            title="Mini goals"
            to="goals"
            sub={active.length ? `${active.length} active` : 'Set a small win'}
            visual={
              active.length ? (
                <span className="row" style={{ gap: 6 }}>
                  {active.slice(0, 3).map((g) => (
                    <ProgressRing key={g.id} value={goalProgress(g, checkIns, training).pct} size={34} stroke={3.5} />
                  ))}
                </span>
              ) : undefined
            }
          />
          <HubCard
            title="Journal"
            to="journal"
            sub={lastEntry ? formatShort(lastEntry.date) : 'Private reflections'}
            visual={lastEntry ? <span className="hub-quote">{(lastEntry.body || lastEntry.training).slice(0, 90)}</span> : undefined}
          />
        </div>
      </Block>
    </Page>
  );
}
