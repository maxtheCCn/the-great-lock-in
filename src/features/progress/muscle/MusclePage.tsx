import { AnimatePresence, motion } from 'motion/react';
import { Box, Dumbbell, RotateCcw, Square, X } from 'lucide-react';
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Block, Page } from '@/components/Page';
import { Badge, Button, Chip, Delta, IconButton, Panel, Segmented } from '@/design/primitives';
import { useTraining } from '@/data/hooks';
import { useSettings } from '@/data/settings';
import { MUSCLES, MUSCLE_BY_ID, MUSCLE_IDS } from '@/data/training/muscles';
import type { MuscleId } from '@/data/types';
import { formatShort, relativeDay } from '@/domain/dates';
import { PERIOD_LABELS, muscleVolume, periodRange, previousRange, type MuscleStat, type Period } from '@/domain/analytics';
import { useToday } from '@/hooks/useNow';
import { useActive } from '@/state/lockin';
import { prefersReducedMotion } from '@/design/visuals';
import { useUI } from '@/state/ui';
import { BodyMap2D } from './BodyMap2D';
import { LEVEL_COLORS, LEVEL_LABELS, levelFor, maxSets, type Level } from './intensity';
import type { ViewSide } from './MuscleScene3D';
import './muscle.css';

const Scene = lazy(() => import('./MuscleScene3D'));

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Fixed, clearly labelled sample used only for the optional preview. */
const SAMPLE: Partial<Record<MuscleId, number>> = { chest: 12, shoulders: 10, triceps: 8, lats: 13, biceps: 7, quads: 11, hamstrings: 6, glutes: 7, calves: 4, abs: 3, traps: 5, forearms: 2 };

function sampleVolume(): Record<MuscleId, MuscleStat> {
  return Object.fromEntries(MUSCLE_IDS.map((id) => [id, { id, sets: SAMPLE[id] ?? 0, directSets: SAMPLE[id] ?? 0, days: SAMPLE[id] ? 2 : 0, lastDate: null, exercises: [] }])) as unknown as Record<MuscleId, MuscleStat>;
}

export default function MusclePage({ params }: { params: Record<string, string> }) {
  const lockIn = useActive();
  const today = useToday();
  const settings = useSettings();
  const training = useTraining(lockIn.id);
  const openSheet = useUI((s) => s.openSheet);
  const [period, setPeriod] = useState<Period>('last30');
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState<MuscleId | null>((params.muscle as MuscleId) ?? null);
  const initialFacing = params.muscle && MUSCLE_BY_ID[params.muscle as MuscleId]?.side === 'back' ? 'back' : 'front';
  const [side, setSide] = useState<ViewSide>(initialFacing === 'back' ? 'back' : null);
  const [facing, setFacing] = useState<'front' | 'back'>(initialFacing);
  const webgl = useMemo(hasWebGL, []);
  const [mode, setMode] = useState<'3d' | '2d'>(webgl ? '3d' : '2d');
  const [preview, setPreview] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);
  /** Selecting from the list turns the figure so the muscle faces the viewer. */
  const pick = (m: MuscleId) => {
    const next = selected === m ? null : m;
    setSelected(next);
    const sideOf = next ? MUSCLE_BY_ID[next].side : 'both';
    if (sideOf !== 'both' && sideOf !== facing) {
      setFacing(sideOf);
      setSide(sideOf);
    }
  };

  const range = periodRange(period, lockIn, today);
  const prev = previousRange(period, range);
  const realVol = useMemo(() => muscleVolume(training, range), [training, range.start, range.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevVol = useMemo(() => (prev ? muscleVolume(training, prev) : null), [training, prev?.start, prev?.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const realEmpty = maxSets(realVol) === 0;
  const showingSample = preview && realEmpty;
  const vol = showingSample ? sampleVolume() : realVol;
  const max = maxSets(vol);
  const levels = useMemo(() => Object.fromEntries(MUSCLE_IDS.map((id) => [id, levelFor(vol[id].sets, max)])) as Record<MuscleId, Level>, [vol, max]);
  const sel = selected ? vol[selected] : null;
  const selPrev = selected && prevVol && !showingSample ? prevVol[selected] : null;
  // Device reduce-motion always wins over the in-app effects setting.
  const effects = prefersReducedMotion() ? 'minimal' : (settings?.effects ?? 'full');
  const ranked = [...MUSCLES].sort((a, b) => vol[b.id].sets - vol[a.id].sets);

  return (
    <Page title="Muscle map" backLabel="Back" plain>
      <Block>
        <Segmented<Period> scroll value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))} />
      </Block>

      <Block>
        <div className="mm-stage">
          <div className="mm-stage__glow" />
          {mode === '3d' && webgl ? (
            <Suspense
              fallback={
                <div className="mm-loading">
                  <span className="btn__spinner" /> Loading 3D model
                </div>
              }
            >
              <Scene
                levels={levels}
                selected={selected}
                onSelect={(m) => setSelected((s) => (s === m ? null : m))}
                side={side}
                onSideSettled={() => setSide(null)}
                effects={effects}
                labelRef={labelRef}
              />
            </Suspense>
          ) : (
            <div className="mm-2d">
              <AnimatePresence mode="wait">
                <motion.div key={facing} initial={{ opacity: 0, rotateY: -60 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: 60 }} transition={{ duration: 0.35 }}>
                  <BodyMap2D volume={vol} side={facing} height={380} selected={selected} onSelect={(m) => setSelected((s) => (s === m ? null : m))} />
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {mode === '3d' && webgl && (
            <div ref={labelRef} className="mm-label" aria-hidden style={{ opacity: 0 }}>
              {selected && (
                <span className="mm-label__inner">
                  {MUSCLE_BY_ID[selected].label}
                  <b>{vol[selected].sets % 1 ? vol[selected].sets.toFixed(1) : vol[selected].sets} sets</b>
                </span>
              )}
            </div>
          )}
          <div className="mm-controls">
            <div className="mm-seg">
              {(['front', 'back'] as const).map((f) => (
                <button
                  key={f}
                  aria-pressed={facing === f}
                  onClick={() => {
                    setFacing(f);
                    setSide(f);
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            {webgl && (
              <IconButton label={mode === '3d' ? 'Switch to 2D map' : 'Switch to 3D model'} size="sm" onClick={() => setMode(mode === '3d' ? '2d' : '3d')}>
                {mode === '3d' ? <Square /> : <Box />}
              </IconButton>
            )}
            {mode === '3d' && (
              <IconButton
                label="Reset view"
                size="sm"
                onClick={() => {
                  setFacing('front');
                  setSide('front');
                }}
              >
                <RotateCcw />
              </IconButton>
            )}
          </div>

          {showingSample && (
            <div className="mm-badge">
              <Badge tone="warn">Sample data · not yours</Badge>
            </div>
          )}
        </div>
        <div className="row between wrap gap-2" style={{ marginTop: 4 }}>
            <div className="mm-legend mm-legend--row" aria-label="Legend">
            {([0, 1, 2, 3] as Level[]).map((l) => (
              <span key={l}>
                <i style={{ background: LEVEL_COLORS[l], boxShadow: l >= 2 ? `0 0 8px ${LEVEL_COLORS[l]}` : 'inset 0 0 0 1px rgba(160,245,184,.15)' }} />
                {l === 0 ? 'None' : LEVEL_LABELS[l]}
              </span>
            ))}
          </div>

          {mode === '3d' && <span className="mm-hint">Drag · pinch · tap</span>}
        </div>
      </Block>

      {realEmpty && (
        <Block>
          <Panel tight>
            <div className="row gap-3">
              <span className="list-row__icon">
                <Dumbbell />
              </span>
              <div className="stack grow">
                <span style={{ fontWeight: 700, fontSize: 14 }}>No logged sets in {PERIOD_LABELS[period].toLowerCase()}</span>
                <span className="t-small" style={{ fontSize: 12 }}>
                  Log a workout with exercises to light up your map.
                </span>
              </div>
            </div>
            <div className="grid-2" style={{ marginTop: 12 }}>
              <Button size="sm" onClick={() => openSheet({ type: 'workout' })}>
                Log workout
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPreview(!preview)}>
                {preview ? 'Hide sample' : 'Preview sample'}
              </Button>
            </div>
          </Panel>
        </Block>
      )}

      <Block>
        <AnimatePresence mode="wait">
          {selected && sel ? (
            <motion.div key={selected} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <Panel
                glow
                eyebrow={<span style={{ color: LEVEL_COLORS[levels[selected]] === LEVEL_COLORS[0] ? undefined : 'var(--mint)' }}>{LEVEL_LABELS[levels[selected]]}</span>}
                title={MUSCLE_BY_ID[selected].label}
                action={
                  <IconButton label="Close details" size="sm" onClick={() => setSelected(null)}>
                    <X />
                  </IconButton>
                }
              >
                {sel.sets === 0 ? (
                  <p className="t-small">No recorded training for this muscle group in {PERIOD_LABELS[period].toLowerCase()}.</p>
                ) : (
                  <>
                    <div className="stat-row">
                      <div className="mini-stat">
                        <div className="mini-stat__value">{sel.sets % 1 ? sel.sets.toFixed(1) : sel.sets}</div>
                        <div className="mini-stat__label">Weighted sets</div>
                      </div>
                      <div className="mini-stat">
                        <div className="mini-stat__value">{sel.days}</div>
                        <div className="mini-stat__label">Days trained</div>
                      </div>
                      <div className="mini-stat">
                        <div className="mini-stat__value" style={{ fontSize: 15, lineHeight: 1.6 }}>
                          {sel.lastDate ? relativeDay(sel.lastDate, today) : '—'}
                        </div>
                        <div className="mini-stat__label">Last trained</div>
                      </div>
                    </div>
                    {sel.exercises.length > 0 && (
                      <div className="stack gap-2" style={{ marginTop: 14 }}>
                        <span className="t-eyebrow">Top exercises</span>
                        {sel.exercises.slice(0, 4).map((e) => (
                          <div key={e.name} className="row between">
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{e.name}</span>
                            <span className="t-mono" style={{ fontSize: 12 }}>
                              {e.sets % 1 ? e.sets.toFixed(1) : e.sets} sets
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {compare && prev && (
                  <div className="row between" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-1)' }}>
                    <span className="t-small">
                      vs {formatShort(prev.start)} - {formatShort(prev.end)}: {selPrev ? (selPrev.sets % 1 ? selPrev.sets.toFixed(1) : selPrev.sets) : 0} sets
                    </span>
                    <Delta value={selPrev ? sel.sets - selPrev.sets : null} neutral />
                  </div>
                )}
              </Panel>
            </motion.div>
          ) : (
            <motion.p key="hint" className="t-small" style={{ textAlign: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Tap a muscle group to inspect its recorded volume.
            </motion.p>
          )}
        </AnimatePresence>
      </Block>

      <Block>
        <div className="row between" style={{ marginBottom: 10 }}>
          <span className="t-eyebrow">All groups</span>
          {prev && (
            <Chip selected={compare} onClick={() => setCompare(!compare)}>
              Compare previous
            </Chip>
          )}
        </div>
        <div className="mm-list">
          {ranked.map((m) => {
            const v = vol[m.id];
            const p = compare && prevVol && !showingSample ? prevVol[m.id] : null;
            return (
              <button key={m.id} className="mm-item" aria-pressed={selected === m.id} onClick={() => pick(m.id)}>
                <i style={{ background: LEVEL_COLORS[levels[m.id]] }} />
                <span className="grow" style={{ textAlign: 'left' }}>
                  {m.label}
                </span>
                <span className="t-mono" style={{ fontSize: 12 }}>
                  {v.sets % 1 ? v.sets.toFixed(1) : v.sets}
                  {p && <span className="t-faint"> / {p.sets % 1 ? p.sets.toFixed(1) : p.sets}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </Block>

      <Block>
        <p className="t-small" style={{ fontSize: 12 }}>
          Brightness compares muscle groups within the selected period, based on logged sets (primary 1, secondary ½). TGLI cannot measure muscle growth, activation or recovery from workout logs. The figure is a stylised model, not an anatomical scan.
        </p>
      </Block>
    </Page>
  );
}
