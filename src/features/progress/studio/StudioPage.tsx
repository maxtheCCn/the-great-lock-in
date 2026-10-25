import { AnimatePresence, motion } from 'motion/react';
import { Columns2, Eye, ImagePlus, Maximize2, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Block, Page } from '@/components/Page';
import { Badge, Button, EmptyState, IconButton, Panel, Segmented } from '@/design/primitives';
import { usePhotos } from '@/data/hooks';
import { useSettings } from '@/data/settings';
import { db } from '@/data/db';
import { saveComparisonNote } from '@/data/repo';
import type { PhotoAngle, ProgressPhoto } from '@/data/types';
import { diffDays, formatDate, formatShort } from '@/domain/dates';
import { useActive } from '@/state/lockin';
import { toast, useUI } from '@/state/ui';
import { imageUrl } from '@/services/images';
import { useFullPhoto } from '../PhotoViewer';
import './studio.css';

type Mode = 'slider' | 'side';

function Compare({ before, after, mode, tall }: { before: ProgressPhoto; after: ProgressPhoto; mode: Mode; tall?: boolean }) {
  const b = useFullPhoto(before);
  const a = useFullPhoto(after);
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromEvent = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  if (mode === 'side') {
    return (
      <div className="studio-side" style={tall ? { height: '100%' } : undefined}>
        {[
          ['Before', before, b],
          ['After', after, a],
        ].map(([label, p, url]) => (
          <div key={label as string} className="studio-frame">
            <img src={url as string} alt={`${label} photo`} draggable={false} />
            <span className="studio-tag">
              {label as string} · {formatShort((p as ProgressPhoto).date)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="studio-slider"
      style={tall ? { height: '100%', aspectRatio: 'auto' } : undefined}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromEvent(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && setFromEvent(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      role="slider"
      aria-label="Before and after comparison"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5));
        if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5));
      }}
    >
      <img src={a} alt="After photo" draggable={false} />
      <img src={b} alt="Before photo" draggable={false} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <span className="studio-tag" style={{ left: 10 }}>
        Before · {formatShort(before.date)}
      </span>
      <span className="studio-tag" style={{ right: 10, left: 'auto' }}>
        After · {formatShort(after.date)}
      </span>
      <div className="studio-handle" style={{ left: `${pos}%` }}>
        <span>
          <SlidersHorizontal size={16} />
        </span>
      </div>
    </div>
  );
}

export default function StudioPage({ params }: { params: Record<string, string> }) {
  const lockIn = useActive();
  const settings = useSettings();
  const photos = usePhotos(lockIn.id);
  const openSheet = useUI((s) => s.openSheet);
  const initialAngle = (photos?.find((p) => p.id === params.after)?.angle ?? 'front') as PhotoAngle;
  const [angle, setAngle] = useState<PhotoAngle>(initialAngle);
  const [mode, setMode] = useState<Mode>('slider');
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(params.after ?? null);
  const [picking, setPicking] = useState<'before' | 'after'>('before');
  const [full, setFull] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const list = useMemo(() => (photos ?? []).filter((p) => p.angle === angle).sort((x, y) => x.date.localeCompare(y.date)), [photos, angle]);

  useEffect(() => {
    if (!list.length) return;
    if (!beforeId || !list.some((p) => p.id === beforeId)) setBeforeId(list[0].id);
    if (!afterId || !list.some((p) => p.id === afterId)) setAfterId(list[list.length - 1].id);
  }, [list, beforeId, afterId]);

  const before = list.find((p) => p.id === beforeId);
  const after = list.find((p) => p.id === afterId);
  const comparison = useLiveQuery(
    () => (before && after ? db.comparisons.filter((c) => c.beforeId === before.id && c.afterId === after.id).first() : undefined),
    [before?.id, after?.id],
  );
  const [note, setNote] = useState('');
  useEffect(() => setNote(comparison?.note ?? ''), [comparison?.id, comparison?.note, before?.id, after?.id]);

  const hidden = settings?.photoBlur && !revealed;

  if (photos && photos.length < 2) {
    return (
      <Page title="Transformation Studio" backLabel="Progress">
        <Block>
          <Panel>
            <EmptyState
              icon={<Columns2 />}
              title="Two photos to compare"
              text="Add progress photos, or import older ones with their original dates, then compare them here."
              action={
                <Button icon={<ImagePlus />} onClick={() => openSheet({ type: 'photos' })}>
                  Add photos
                </Button>
              }
            />
          </Panel>
        </Block>
      </Page>
    );
  }

  return (
    <Page
      title="Transformation Studio"
      backLabel="Back"
      heroRight={
        <IconButton label="Import older photos" onClick={() => openSheet({ type: 'photos' })}>
          <ImagePlus />
        </IconButton>
      }
    >
      <Block>
        <div className="row gap-2">
          <div className="grow">
            <Segmented<PhotoAngle>
              value={angle}
              onChange={setAngle}
              options={[
                { value: 'front', label: 'Front' },
                { value: 'side', label: 'Side' },
                { value: 'back', label: 'Back' },
              ]}
            />
          </div>
        </div>
      </Block>

      {list.length < 2 ? (
        <Block>
          <Panel>
            <p className="t-small">You need at least two {angle} photos to compare. Try another angle or add more photos.</p>
          </Panel>
        </Block>
      ) : (
        before &&
        after && (
          <>
            <Block>
              <div style={{ position: 'relative' }}>
                <Compare before={before} after={after} mode={mode} />
                {hidden && (
                  <button className="studio-veil" onClick={() => setRevealed(true)}>
                    <Eye /> Tap to reveal
                  </button>
                )}
              </div>
            </Block>
            <Block>
              <div className="row gap-2">
                <div className="grow">
                  <Segmented<Mode>
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: 'slider', label: 'Slider' },
                      { value: 'side', label: 'Side by side' },
                    ]}
                  />
                </div>
                <IconButton label="Full screen" onClick={() => setFull(true)}>
                  <Maximize2 />
                </IconButton>
              </div>
            </Block>
            <Block>
              <Panel tight>
                <div className="row between">
                  <span className="t-small">
                    {formatDate(before.date)} → {formatDate(after.date)}
                  </span>
                  <Badge>{Math.abs(diffDays(before.date, after.date))} days</Badge>
                </div>
              </Panel>
            </Block>
            <Block>
              <div className="row between" style={{ marginBottom: 8 }}>
                <span className="t-eyebrow">Timeline · choosing {picking}</span>
                <Segmented<'before' | 'after'>
                  value={picking}
                  onChange={setPicking}
                  options={[
                    { value: 'before', label: 'Before' },
                    { value: 'after', label: 'After' },
                  ]}
                />
              </div>
              <div className="studio-strip">
                {list.map((p) => {
                  const isB = p.id === before.id;
                  const isA = p.id === after.id;
                  return (
                    <motion.button
                      key={p.id}
                      className="studio-strip__item"
                      data-sel={isB || isA}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => (picking === 'before' ? setBeforeId(p.id) : setAfterId(p.id))}
                    >
                      <img src={imageUrl(`thumb:${p.id}`, p.thumb)} alt={formatDate(p.date)} style={{ filter: hidden ? 'blur(10px)' : undefined }} draggable={false} />
                      {(isB || isA) && <span className="studio-strip__mark">{isB && isA ? 'B·A' : isB ? 'B' : 'A'}</span>}
                      <span className="studio-strip__date">{formatShort(p.date)}</span>
                    </motion.button>
                  );
                })}
              </div>
            </Block>
            <Block>
              <Panel eyebrow="Comparison note" action={<span className="t-eyebrow">Optional</span>}>
                <textarea className="input" rows={3} maxLength={400} value={note} placeholder="What do you notice? Energy, strength, how clothes fit" onChange={(e) => setNote(e.target.value)} />
                <Button
                  size="sm"
                  variant="secondary"
                  style={{ marginTop: 10 }}
                  disabled={note === (comparison?.note ?? '')}
                  onClick={async () => {
                    await saveComparisonNote(lockIn.id, before.id, after.id, note.trim());
                    toast('Note saved', { tone: 'success' });
                  }}
                >
                  Save note
                </Button>
              </Panel>
            </Block>
            <Block>
              <p className="t-small" style={{ fontSize: 12 }}>
                TGLI never analyses or rates your appearance. Lighting, posture and time of day change photos a lot, so compare like with like.
              </p>
            </Block>
          </>
        )
      )}

      {createPortal(
        <AnimatePresence>
          {full && before && after && (
            <motion.div className="studio-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="studio-full__top">
                <IconButton label="Exit full screen" onClick={() => setFull(false)}>
                  <X />
                </IconButton>
                <Segmented<Mode>
                  value={mode}
                  onChange={setMode}
                  layoutId="studio-full-mode"
                  options={[
                    { value: 'slider', label: 'Slider' },
                    { value: 'side', label: 'Side by side' },
                  ]}
                />
              </div>
              <div className="studio-full__stage">
                <Compare before={before} after={after} mode={mode} tall />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Page>
  );
}
