import { AnimatePresence, motion } from 'motion/react';
import { BedDouble, Camera, ChevronRight, Dumbbell, Eye, ImagePlus, Plus, Ruler } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Block, Page } from '@/components/Page';
import { Badge, Button, Delta, EmptyState, Panel, Segmented, SelectPicker } from '@/design/primitives';
import { BarChart, LineChart, Sparkline } from '@/design/charts';
import { AnimatedNumber } from '@/design/visuals';
import { useCheckIns, useMeasurements, usePhotos, useTraining, useWorkoutRows } from '@/data/hooks';
import { useSettings } from '@/data/settings';
import type { PhotoAngle, ProgressPhoto } from '@/data/types';
import { MUSCLES } from '@/data/training/muscles';
import { addDays, addMonths, diffDays, formatDate, formatShort, maxDate, minDate, startOfMonth, startOfWeek } from '@/domain/dates';
import {
  PERIOD_LABELS,
  delta,
  monthlyAverages,
  muscleVolume,
  periodRange,
  previousRange,
  rollingAverage,
  sleepSeries,
  sleepStats,
  totalSets,
  trainingSummary,
  weeklyAverages,
  weeklyVolume,
  type Period,
} from '@/domain/analytics';
import { fmtLength, lengthUnit, measurementLabel, measurementTypes, toDisplayLength } from '@/domain/measurements';
import { useToday } from '@/hooks/useNow';
import { useActive } from '@/state/lockin';
import { useUI } from '@/state/ui';
import { useNav } from '@/nav/store';
import { imageUrl } from '@/services/images';
import { PhotoViewer } from './PhotoViewer';
import './progress.css';

const fmt1 = (v: number | null, unit = '') => (v === null ? '—' : `${v.toFixed(1)}${unit}`);

function MiniStat({ value, unit, label }: { value: React.ReactNode; unit?: string; label: string }) {
  return (
    <div className="mini-stat">
      <div className="mini-stat__value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="mini-stat__label">{label}</div>
    </div>
  );
}

/* ═══════════════════════ Sleep ═══════════════════════ */

type SleepPeriod = '14' | '30' | 'lockIn';

export function SleepPage() {
  const lockIn = useActive();
  const today = useToday();
  const settings = useSettings();
  const checkIns = useCheckIns(lockIn.id);
  const [period, setPeriod] = useState<SleepPeriod>('30');

  const end = minDate(today, lockIn.targetDate);
  const range = { start: period === 'lockIn' ? lockIn.startDate : maxDate(addDays(end, period === '14' ? -13 : -29), lockIn.startDate), end };
  const stats = sleepStats(checkIns, range);
  const series = sleepSeries(checkIns, range).map((p) => ({ x: p.date, y: p.value }));
  const rolling = rollingAverage(sleepSeries(checkIns, range)).map((p) => ({ x: p.date, y: p.value }));
  const weekly = weeklyAverages(checkIns, { start: lockIn.startDate, end });
  const monthly = monthlyAverages(checkIns, { start: lockIn.startDate, end });

  const thisWeek = sleepStats(checkIns, { start: startOfWeek(today), end: today }).avg;
  const lastWeek = sleepStats(checkIns, { start: addDays(startOfWeek(today), -7), end: addDays(startOfWeek(today), -1) }).avg;
  const thisMonth = sleepStats(checkIns, { start: startOfMonth(today), end: today }).avg;
  const lastMonthStart = addMonths(startOfMonth(today), -1);
  const lastMonth = sleepStats(checkIns, { start: lastMonthStart, end: addDays(startOfMonth(today), -1) }).avg;
  const youth = settings?.ageGroup === 'under16' || settings?.ageGroup === '16to17';
  const band: [number, number] = youth ? [8, 10] : [7, 9];
  const recent = [...checkIns].filter((c) => c.date <= end).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  return (
    <Page title="Sleep" backLabel="Progress" subtitle="Calculated only from nights you recorded. Missing nights are left out, never counted as zero.">
      <Block>
        <Segmented<SleepPeriod>
          value={period}
          onChange={setPeriod}
          options={[
            { value: '14', label: '14 days' },
            { value: '30', label: '30 days' },
            { value: 'lockIn', label: 'Lock In' },
          ]}
        />
      </Block>
      <Block>
        <Panel glow>
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div className="stack">
              <span className="t-eyebrow">Average</span>
              <span className="t-num" style={{ fontSize: 52, lineHeight: 1, marginTop: 8 }}>
                {stats.avg === null ? '—' : <AnimatedNumber value={stats.avg} decimals={1} />}
                <span style={{ fontSize: 18, color: 'var(--text-3)' }}>{stats.avg !== null && 'h'}</span>
              </span>
            </div>
            <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge tone="muted">{stats.nights} nights recorded</Badge>
              {stats.stdDev !== null && <span className="t-small">± {stats.stdDev.toFixed(1)}h night to night</span>}
            </div>
          </div>
          <div style={{ marginTop: 22 }}>
            <LineChart
              data={series}
              overlay={rolling}
              unit="h"
              digits={2}
              band={band}
              bandLabel={`${band[0]}-${band[1]}h typical guidance`}
              floor={4}
              ceil={10}
              formatX={(x) => formatShort(x)}
              emptyLabel="No nights recorded in this period"
            />
          </div>
          <div className="legend" style={{ marginTop: 12 }}>
            <span>
              <i style={{ background: 'var(--mint)' }} />
              Nightly
            </span>
            <span>
              <i style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(245,255,247,.6)' }} />
              7-night average (≥3 nights)
            </span>
          </div>
        </Panel>
      </Block>
      <Block>
        <div className="stat-row">
          <MiniStat value={stats.total ? Math.round(stats.total) : '—'} unit={stats.total ? 'h' : undefined} label="Total recorded" />
          <MiniStat value={stats.min === null ? '—' : stats.min} unit={stats.min === null ? undefined : 'h'} label="Shortest" />
          <MiniStat value={stats.max === null ? '—' : stats.max} unit={stats.max === null ? undefined : 'h'} label="Longest" />
        </div>
      </Block>
      <Block>
        <Panel eyebrow="Changes between periods">
          <div className="stack gap-3">
            {[
              ['This week vs last week', thisWeek, lastWeek],
              ['This month vs last month', thisMonth, lastMonth],
            ].map(([label, a, b]) => (
              <div key={label as string} className="row between">
                <div className="stack">
                  <span style={{ fontWeight: 650, fontSize: 14 }}>{label as string}</span>
                  <span className="t-small" style={{ fontSize: 12 }}>
                    {fmt1(a as number | null, 'h')} vs {fmt1(b as number | null, 'h')}
                  </span>
                </div>
                <Delta value={delta(a as number | null, b as number | null)} unit="h" neutral />
              </div>
            ))}
          </div>
        </Panel>
      </Block>
      <Block>
        <Panel eyebrow="Weekly averages" action={<span className="t-eyebrow">Entire Lock In</span>}>
          <BarChart
            data={weekly.slice(-10).map((w) => ({ key: w.key, label: formatDate(w.key, { day: 'numeric', month: 'numeric' }), value: w.avg, sub: `Week of ${formatShort(w.key)} · ${w.count}n`, highlight: w.key === startOfWeek(today) }))}
            unit="h"
            digits={1}
            target={band[0]}
            targetLabel={`${band[0]}h`}
          />
        </Panel>
      </Block>
      <Block>
        <Panel eyebrow="Monthly averages">
          <div className="stack gap-2">
            {monthly.map((m) => (
              <div key={m.key} className="row between">
                <span style={{ fontWeight: 650, fontSize: 14 }}>{formatDate(`${m.key}-01`, { month: 'long', year: 'numeric' })}</span>
                <span className="t-mono" style={{ fontSize: 13 }}>
                  {m.avg === null ? <span className="t-faint">no nights</span> : `${m.avg.toFixed(1)}h`} <span className="t-faint">· {m.count}n</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </Block>
      <Block>
        <Panel eyebrow="Recent nights">
          {recent.length === 0 ? (
            <p className="t-small">Record sleep in your daily check-in to see it here.</p>
          ) : (
            <div className="stack gap-2">
              {recent.map((c) => (
                <div key={c.id} className="row gap-3">
                  <BedDouble size={15} color="var(--text-3)" />
                  <span className="grow" style={{ fontSize: 14 }}>
                    {formatDate(c.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <span className="t-mono" style={{ fontSize: 13, color: c.sleepHours === null ? 'var(--text-4)' : undefined }}>
                    {c.sleepHours === null ? 'not recorded' : `${c.sleepHours}h`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Block>
    </Page>
  );
}

/* ═══════════════════════ Measurements ═══════════════════════ */

export function MeasurementsPage() {
  const lockIn = useActive();
  const settings = useSettings();
  const measurements = useMeasurements(lockIn.id);
  const openSheet = useUI((s) => s.openSheet);
  const push = useNav((s) => s.push);
  const units = settings?.units ?? 'metric';
  const types = measurementTypes(settings?.customMeasurements);
  const dates = useMemo(() => [...new Set(measurements.map((m) => m.date))].sort().reverse(), [measurements]);
  const [a, setA] = useState<string>('');
  const [b, setB] = useState<string>('');
  const from = a || dates[dates.length - 1] || '';
  const to = b || dates[0] || '';

  const byKind = types
    .map((t) => ({ ...t, rows: measurements.filter((m) => m.kind === t.id).sort((x, y) => x.date.localeCompare(y.date)) }))
    .filter((t) => t.rows.length);

  return (
    <Page
      title="Measurements"
      backLabel="Progress"
      subtitle="Track only what helps you. Measurements never affect check-ins or your Lock In."
      heroRight={
        <Button size="sm" icon={<Plus />} onClick={() => openSheet({ type: 'measurement' })}>
          Add
        </Button>
      }
    >
      {byKind.length === 0 ? (
        <Block>
          <Panel>
            <EmptyState
              icon={<Ruler />}
              title="No measurements yet"
              text="Arm, chest, waist, hip, thigh, or your own custom measurement. Add one whenever you like, or never."
              action={
                <Button icon={<Plus />} onClick={() => openSheet({ type: 'measurement' })}>
                  Add a measurement
                </Button>
              }
            />
          </Panel>
        </Block>
      ) : (
        <>
          <Block>
            <div className="hub-grid">
              {byKind.map((t) => {
                const first = t.rows[0];
                const last = t.rows[t.rows.length - 1];
                return (
                  <motion.button key={t.id} type="button" className="hub-card" onClick={() => push('measurement', { kind: t.id })} whileTap={{ scale: 0.97 }} style={{ minHeight: 120 }}>
                    <div className="row between">
                      <span className="hub-card__title">{t.label}</span>
                      <Sparkline values={t.rows.map((r) => r.valueCm)} width={60} height={22} />
                    </div>
                    <div className="stack">
                      <span className="hub-card__stat">
                        {toDisplayLength(last.valueCm, units).toFixed(1)}
                        <small>{lengthUnit(units)}</small>
                      </span>
                      <span className="row gap-2">
                        <Delta value={t.rows.length > 1 ? toDisplayLength(last.valueCm - first.valueCm, units) : null} unit={` ${lengthUnit(units)}`} neutral />
                      </span>
                      <span className="hub-card__sub">
                        {t.rows.length} entries · {formatShort(last.date)}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </Block>
          {dates.length >= 2 && (
            <Block>
              <Panel eyebrow="Compare dates">
                <div className="grid-2">
                  <SelectPicker label="From date" value={from} onChange={setA} options={dates.map((d) => ({ value: d, label: formatDate(d) }))} />
                  <SelectPicker label="To date" value={to} onChange={setB} options={dates.map((d) => ({ value: d, label: formatDate(d) }))} />
                </div>
                <div className="stack gap-2" style={{ marginTop: 14 }}>
                  {byKind.map((t) => {
                    const va = t.rows.find((r) => r.date === from);
                    const vb = t.rows.find((r) => r.date === to);
                    return (
                      <div key={t.id} className="row between">
                        <span style={{ fontWeight: 650, fontSize: 14 }}>{t.label}</span>
                        <span className="row gap-3">
                          <span className="t-mono" style={{ fontSize: 12 }}>
                            {va ? fmtLength(va.valueCm, units) : '—'} → {vb ? fmtLength(vb.valueCm, units) : '—'}
                          </span>
                          <Delta value={va && vb ? toDisplayLength(vb.valueCm - va.valueCm, units) : null} unit="" neutral />
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="t-small" style={{ fontSize: 11.5, marginTop: 10 }}>
                  Only measurements taken on exactly those dates are compared.
                </p>
              </Panel>
            </Block>
          )}
        </>
      )}
    </Page>
  );
}

export function MeasurementDetailPage({ params }: { params: Record<string, string> }) {
  const lockIn = useActive();
  const settings = useSettings();
  const measurements = useMeasurements(lockIn.id);
  const openSheet = useUI((s) => s.openSheet);
  const units = settings?.units ?? 'metric';
  const kind = params.kind;
  const rows = measurements.filter((m) => m.kind === kind).sort((a, b) => a.date.localeCompare(b.date));
  const label = measurementLabel(kind, settings?.customMeasurements);

  return (
    <Page
      title={label}
      backLabel="Measurements"
      heroRight={
        <Button size="sm" icon={<Plus />} onClick={() => openSheet({ type: 'measurement', kind })}>
          Add
        </Button>
      }
    >
      <Block>
        <Panel>
          <LineChart
            data={rows.map((r) => ({ x: r.date, y: Math.round(toDisplayLength(r.valueCm, units) * 10) / 10 }))}
            unit={` ${lengthUnit(units)}`}
            formatX={(x) => formatShort(x)}
            showDots
            emptyLabel="No entries"
          />
        </Panel>
      </Block>
      <Block>
        <div className="list">
          {[...rows].reverse().map((r, i, arr) => {
            const prev = arr[i + 1];
            return (
              <button key={r.id} className="list-row" onClick={() => openSheet({ type: 'measurement', id: r.id })}>
                <span className="stack grow">
                  <span className="list-row__title">{fmtLength(r.valueCm, units)}</span>
                  <span className="list-row__sub">
                    {formatDate(r.date)}
                    {r.note && ` · ${r.note}`}
                  </span>
                </span>
                {prev && <Delta value={toDisplayLength(r.valueCm - prev.valueCm, units)} neutral />}
                <span className="list-row__chev">
                  <ChevronRight />
                </span>
              </button>
            );
          })}
        </div>
      </Block>
    </Page>
  );
}

/* ═══════════════════════ Photos ═══════════════════════ */

export function PhotoThumb({ photo, blur, onClick, size }: { photo: ProgressPhoto; blur?: boolean; onClick?: () => void; size?: number }) {
  const [revealed, setRevealed] = useState(false);
  const hidden = blur && !revealed;
  return (
    <motion.button
      type="button"
      className="photo-thumb"
      onClick={() => (hidden ? setRevealed(true) : onClick?.())}
      whileTap={{ scale: 0.96 }}
      style={size ? { width: size } : undefined}
      aria-label={`${photo.angle} photo, ${formatDate(photo.date)}${hidden ? ', blurred, tap to reveal' : ''}`}
    >
      <img src={imageUrl(`thumb:${photo.id}`, photo.thumb)} alt="" style={{ filter: hidden ? 'blur(18px) saturate(0.6)' : undefined }} draggable={false} />
      <span className="photo-thumb__angle">{photo.angle}</span>
      {hidden && (
        <span className="photo-thumb__reveal">
          <Eye size={16} />
        </span>
      )}
    </motion.button>
  );
}

export function PhotosPage() {
  const lockIn = useActive();
  const settings = useSettings();
  const photos = usePhotos(lockIn.id);
  const openSheet = useUI((s) => s.openSheet);
  const push = useNav((s) => s.push);
  const [angle, setAngle] = useState<PhotoAngle | 'all'>('all');
  const [viewing, setViewing] = useState<string | null>(null);
  const list = (photos ?? []).filter((p) => angle === 'all' || p.angle === angle);
  const weeks = useMemo(() => {
    const m = new Map<string, ProgressPhoto[]>();
    for (const p of [...list].sort((a, b) => b.date.localeCompare(a.date))) {
      const w = startOfWeek(p.date);
      if (!m.has(w)) m.set(w, []);
      m.get(w)!.push(p);
    }
    return [...m.entries()];
  }, [list]);

  return (
    <Page
      title="Progress photos"
      backLabel="Progress"
      subtitle="Weekly if you like, skipped weeks are fine. Never analysed, rated or shared."
      heroRight={
        <Button size="sm" icon={<ImagePlus />} onClick={() => openSheet({ type: 'photos' })}>
          Add
        </Button>
      }
    >
      {photos && photos.length === 0 ? (
        <Block>
          <Panel>
            <EmptyState
              icon={<Camera />}
              title="Your private timeline"
              text="Add front, side and back photos whenever you want. Import older photos and assign their original dates."
              action={
                <Button icon={<ImagePlus />} onClick={() => openSheet({ type: 'photos' })}>
                  Add photos
                </Button>
              }
            />
          </Panel>
        </Block>
      ) : (
        <>
          <Block>
            <Segmented
              value={angle}
              onChange={setAngle}
              options={[
                { value: 'all', label: 'All' },
                { value: 'front', label: 'Front' },
                { value: 'side', label: 'Side' },
                { value: 'back', label: 'Back' },
              ]}
            />
          </Block>
          {(photos?.length ?? 0) >= 2 && (
            <Block>
              <Button variant="secondary" block onClick={() => push('studio')}>
                Open Transformation Studio
              </Button>
            </Block>
          )}
          {weeks.map(([w, ps]) => (
            <Block key={w}>
              <div className="row between" style={{ margin: '6px 2px 10px' }}>
                <span className="t-eyebrow">
                  Week {Math.floor(diffDays(startOfWeek(lockIn.startDate), w) / 7) + 1} · {formatShort(w)}
                </span>
                <span className="t-eyebrow">{ps.length}</span>
              </div>
              <div className="photo-grid">
                {ps.map((p) => (
                  <PhotoThumb key={p.id} photo={p} blur={settings?.photoBlur} onClick={() => setViewing(p.id)} />
                ))}
              </div>
            </Block>
          ))}
        </>
      )}
      <AnimatePresence>{viewing && photos && <PhotoViewer photos={list} startId={viewing} onClose={() => setViewing(null)} />}</AnimatePresence>
    </Page>
  );
}

/* ═══════════════════════ Training balance ═══════════════════════ */

const GROUP_LABEL = { push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core' } as const;
const GROUP_COLOR = { push: '#a8f5c0', pull: '#37d978', legs: '#1a9e52', core: '#6fd6a5' } as const;

export function BalancePage() {
  const lockIn = useActive();
  const today = useToday();
  const training = useTraining(lockIn.id);
  const checkIns = useCheckIns(lockIn.id);
  const push = useNav((s) => s.push);
  const [period, setPeriod] = useState<Period>('thisWeek');
  const range = periodRange(period, lockIn, today);
  const prev = previousRange(period, range);
  const vol = useMemo(() => muscleVolume(training, range), [training, range.start, range.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevVol = useMemo(() => (prev ? muscleVolume(training, prev) : null), [training, prev?.start, prev?.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(1, ...MUSCLES.map((m) => Math.max(vol[m.id].sets, prevVol?.[m.id].sets ?? 0)));
  const groups = (['push', 'pull', 'legs', 'core'] as const).map((g) => ({ g, sets: MUSCLES.filter((m) => m.group === g).reduce((a, m) => a + vol[m.id].sets, 0) }));
  const groupTotal = groups.reduce((a, g) => a + g.sets, 0);
  const upper = MUSCLES.filter((m) => m.region === 'upper').reduce((a, m) => a + vol[m.id].sets, 0);
  const lower = MUSCLES.filter((m) => m.region === 'lower').reduce((a, m) => a + vol[m.id].sets, 0);
  const sets = totalSets(training, range);
  const prevSets = prev ? totalSets(training, prev) : null;
  const weeks = weeklyVolume(training, checkIns, { start: lockIn.startDate, end: minDate(today, lockIn.targetDate) });
  const sorted = [...MUSCLES].sort((a, b) => vol[b.id].sets - vol[a.id].sets);

  return (
    <Page title="Training balance" backLabel="Progress" subtitle="Where your recorded sets went. Primary muscles count 1 set, secondary ½.">
      <Block>
        <Segmented<Period> scroll value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))} />
      </Block>
      <Block>
        <Panel glow>
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div className="stack">
              <span className="t-eyebrow">Logged sets</span>
              <span className="t-num" style={{ fontSize: 46, lineHeight: 1, marginTop: 8 }}>
                <AnimatedNumber value={sets} />
              </span>
            </div>
            <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
              <Delta value={prevSets === null ? null : sets - prevSets} digits={0} neutral />
              <span className="t-small" style={{ fontSize: 12 }}>
                {prev ? `vs ${formatShort(prev.start)} - ${formatShort(prev.end)}` : 'Whole Lock In'}
              </span>
            </div>
          </div>
          <div className="divider" />
          <div className="distribution" style={{ height: 14 }}>
            {groups.map((g, i) =>
              g.sets ? (
                <motion.span key={g.g} style={{ flex: g.sets, background: GROUP_COLOR[g.g] }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.08, duration: 0.6 }} />
              ) : null,
            )}
          </div>
          <div className="legend" style={{ marginTop: 10, justifyContent: 'space-between' }}>
            {groups.map((g) => (
              <span key={g.g}>
                <i style={{ background: GROUP_COLOR[g.g] }} />
                {GROUP_LABEL[g.g]} {groupTotal ? Math.round((g.sets / groupTotal) * 100) : 0}%
              </span>
            ))}
          </div>
          <p className="t-small" style={{ fontSize: 12, marginTop: 12 }}>
            Upper {upper.toFixed(0)} · Lower {lower.toFixed(0)} weighted sets. Balance depends on your goals. This is information, not a score.
          </p>
        </Panel>
      </Block>
      <Block>
        <Panel eyebrow="By muscle group" action={prev && <span className="t-eyebrow">│ = previous</span>}>
          {sets === 0 ? (
            <EmptyState icon={<Dumbbell />} title="No logged sets in this period" text="Log exercises and sets after a workout to see your training balance." />
          ) : (
            <div className="stack">
              {sorted.map((m, i) => {
                const v = vol[m.id];
                const p = prevVol?.[m.id];
                return (
                  <button key={m.id} className="hbar" onClick={() => push('muscles', { muscle: m.id })}>
                    <span className="hbar__label" style={{ color: v.sets ? undefined : 'var(--text-4)' }}>
                      {m.label}
                    </span>
                    <span className="hbar__track">
                      <motion.span
                        className="hbar__fill"
                        style={{ width: `${(v.sets / max) * 100}%`, background: 'linear-gradient(90deg,#1a9e52,#a0f5b8)' }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: i * 0.03, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      />
                      {p && p.sets > 0 && <span className="hbar__prev" style={{ left: `calc(${(p.sets / max) * 100}% - 1px)` }} />}
                    </span>
                    <span className="hbar__value">
                      {v.sets % 1 ? v.sets.toFixed(1) : v.sets}
                      <span className="t-faint"> · {v.days}d</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="t-small" style={{ fontSize: 11.5, marginTop: 10 }}>
            Sets · days trained. TGLI can't measure muscle growth or activation, only what you logged.
          </p>
        </Panel>
      </Block>
      <Block>
        <Panel eyebrow="Weekly volume" action={<span className="t-eyebrow">Sets per week</span>}>
          <BarChart data={weeks.slice(-10).map((w) => ({ key: w.key, label: formatDate(w.key, { day: 'numeric', month: 'numeric' }), value: w.sets, sub: `Week of ${formatShort(w.key)}`, highlight: w.key === startOfWeek(today) }))} digits={0} unit=" sets" />
        </Panel>
      </Block>
    </Page>
  );
}

/* ═══════════════════════ Workouts ═══════════════════════ */

export function WorkoutsPage() {
  const lockIn = useActive();
  const today = useToday();
  const rows = useWorkoutRows(lockIn.id);
  const training = useTraining(lockIn.id);
  const checkIns = useCheckIns(lockIn.id);
  const openSheet = useUI((s) => s.openSheet);
  const full = { start: lockIn.startDate, end: minDate(today, lockIn.targetDate) };
  const t = trainingSummary(checkIns, training, full);
  const weeks = weeklyVolume(training, checkIns, full);
  const weeksElapsed = Math.max(1, diffDays(lockIn.startDate, full.end) + 1) / 7;
  const durations = rows.map((r) => r.durationMin).filter((d): d is number => d !== null);
  const exTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of training) for (const e of w.exercises) m.set(e.name, (m.get(e.name) ?? 0) + e.sets);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [training]);

  return (
    <Page
      title="Workouts"
      backLabel="Progress"
      heroRight={
        <Button size="sm" icon={<Plus />} onClick={() => openSheet({ type: 'workout' })}>
          Log
        </Button>
      }
    >
      <Block>
        <div className="stat-row">
          <MiniStat value={t.sessions} label="Sessions" />
          <MiniStat value={(t.sessions / weeksElapsed).toFixed(1)} unit={`/${lockIn.weeklyFrequency}`} label="Per week · plan" />
          <MiniStat value={t.restDays} label="Rest days" />
        </div>
      </Block>
      <Block>
        <div className="stat-row">
          <MiniStat value={totalSets(training, null)} label="Logged sets" />
          <MiniStat value={durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : '—'} unit={durations.length ? 'min' : undefined} label="Avg duration" />
          <MiniStat value={t.missed} label="Missed" />
        </div>
      </Block>
      <Block>
        <Panel eyebrow="Sessions per week" action={<span className="t-eyebrow">Plan {lockIn.weeklyFrequency}×</span>}>
          <BarChart
            data={weeks.slice(-10).map((w) => ({ key: w.key, label: formatDate(w.key, { day: 'numeric', month: 'numeric' }), value: w.sessions, sub: `Week of ${formatShort(w.key)}`, highlight: w.key === startOfWeek(today) }))}
            digits={0}
            target={lockIn.weeklyFrequency}
            targetLabel="plan"
            ceil={7}
          />
          <p className="t-small" style={{ fontSize: 11.5, marginTop: 8 }}>
            Sessions = logged workouts + check-ins marked "workout" without a detailed log.
          </p>
        </Panel>
      </Block>
      {exTotals.length > 0 && (
        <Block>
          <Panel eyebrow="Most logged exercises">
            <div className="stack gap-2">
              {exTotals.map(([name, sets]) => (
                <div key={name} className="row between">
                  <span style={{ fontWeight: 650, fontSize: 14 }}>{name}</span>
                  <span className="t-mono" style={{ fontSize: 12 }}>
                    {sets} sets
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </Block>
      )}
      <Block>
        <div className="t-eyebrow section-label" style={{ marginTop: 4 }}>
          Logged workouts
        </div>
        {rows.length === 0 ? (
          <Panel>
            <EmptyState icon={<Dumbbell />} title="No detailed workouts yet" text="Quick check-ins still count as sessions. Log exercises and sets to power the muscle map." />
          </Panel>
        ) : (
          <div className="list">
            {[...rows].reverse().map((w) => (
              <button key={w.id} className="list-row" onClick={() => openSheet({ type: 'workout', id: w.id })}>
                <span className="list-row__icon">
                  <Dumbbell />
                </span>
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <span className="list-row__title">
                    {w.title} {w.source === 'demo' && <Badge tone="warn">Demo</Badge>}
                  </span>
                  <span className="list-row__sub">
                    {formatDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {w.exercises.reduce((a, e) => a + e.sets, 0)} sets
                    {w.durationMin ? ` · ${w.durationMin} min` : ''}
                  </span>
                </span>
                <span className="list-row__chev">
                  <ChevronRight />
                </span>
              </button>
            ))}
          </div>
        )}
      </Block>
      <Block>
        <Panel tight>
          <span className="t-small" style={{ fontSize: 12 }}>
            Detailed gym logging and personal records stay in NW Log. A connection between the two apps is planned for a later phase. Until then, TGLI uses its own simple log.
          </span>
        </Panel>
      </Block>
    </Page>
  );
}
