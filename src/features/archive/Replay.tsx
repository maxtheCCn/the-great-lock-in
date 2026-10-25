import { AnimatePresence, motion } from 'motion/react';
import { Film, Lock, Pause, Play, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, IconButton, Toggle } from '@/design/primitives';
import { AnimatedNumber, prefersReducedMotion } from '@/design/visuals';
import { Emblem } from '@/components/Emblem';
import { ParticleField } from '@/components/ParticleField';
import { RATING_COLOR } from '@/components/ratings';
import { db } from '@/data/db';
import type { ProgressPhoto } from '@/data/types';
import { formatDate, formatRange, formatShort } from '@/domain/dates';
import { MILESTONE_BY_KEY } from '@/domain/milestones';
import { imageUrl } from '@/services/images';
import { toast } from '@/state/ui';
import { loadReplayData, type ReplayData } from './replayData';
import { renderReplayVideo, videoSupported } from './replayVideo';
import './replay.css';

const SLIDE_MS = 4200;

function Big({ children }: { children: React.ReactNode }) {
  return <div className="rp-big">{children}</div>;
}
function Kicker({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div className="rp-kicker" initial={{ opacity: 0, letterSpacing: '0.6em' }} animate={{ opacity: 1, letterSpacing: '0.3em' }} transition={{ delay, duration: 1 }}>
      {children}
    </motion.div>
  );
}
const rise = (delay = 0) => ({ initial: { opacity: 0, y: 24, filter: 'blur(10px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: { delay, duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } });

function buildSlides(d: ReplayData, photos: { before?: string; after?: string; beforeDate?: string; afterDate?: string }) {
  const slides: { key: string; node: React.ReactNode }[] = [
    {
      key: 'intro',
      node: (
        <>
          <Kicker>Transformation replay</Kicker>
          <motion.h1 className="rp-title" {...rise(0.3)}>
            {d.lockIn.name}
          </motion.h1>
          <motion.p className="rp-sub" {...rise(0.7)}>
            {formatRange(d.lockIn.startDate, d.lockIn.targetDate)}
          </motion.p>
        </>
      ),
    },
    {
      key: 'mission',
      node: (
        <>
          <Kicker>The mission</Kicker>
          <div className="stack gap-2" style={{ marginTop: 24 }}>
            {d.goals.map((g, i) => (
              <motion.div key={g} className="rp-goal" {...rise(0.3 + i * 0.18)}>
                {g}
              </motion.div>
            ))}
          </div>
          {d.lockIn.motivation && (
            <motion.p className="rp-quote" {...rise(0.4 + d.goals.length * 0.18)}>
              “{d.lockIn.motivation}”
            </motion.p>
          )}
        </>
      ),
    },
    {
      key: 'days',
      node: (
        <>
          <Big>
            <AnimatedNumber value={d.elapsedDays} duration={2} />
          </Big>
          <Kicker delay={0.2}>Days locked in</Kicker>
          <motion.p className="rp-sub" {...rise(0.8)}>
            {d.checkIns} check-ins recorded
          </motion.p>
        </>
      ),
    },
    {
      key: 'mosaic',
      node: (
        <>
          <Kicker>Every day, your colour</Kicker>
          <div className="rp-mosaic" style={{ gridTemplateColumns: `repeat(${d.totalDays > 120 ? 18 : d.totalDays > 60 ? 12 : 10}, 1fr)` }}>
            {d.mosaic.map((m, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + (i / d.mosaic.length) * 2.2, duration: 0.3 }}
                style={{ background: m && m !== 'logged' ? RATING_COLOR[m] : m === 'logged' ? 'rgba(160,245,184,0.45)' : '#1d2721' }}
              />
            ))}
          </div>
        </>
      ),
    },
    {
      key: 'training',
      node: (
        <>
          <Big>
            <AnimatedNumber value={d.sessions} duration={1.8} />
          </Big>
          <Kicker delay={0.2}>Workouts recorded</Kicker>
          <motion.p className="rp-sub" {...rise(0.8)}>
            {d.sets} logged sets · {d.restDays} planned rest days
          </motion.p>
        </>
      ),
    },
    {
      key: 'sleep',
      node: (
        <>
          <Big>{d.sleepAvg === null ? '—' : <><AnimatedNumber value={d.sleepAvg} decimals={1} duration={1.8} />h</>}</Big>
          <Kicker delay={0.2}>Average sleep</Kicker>
          <motion.p className="rp-sub" {...rise(0.8)}>
            {d.sleepNights} nights recorded
            {d.firstWeekSleep !== null && d.lastWeekSleep !== null && ` · first week ${d.firstWeekSleep.toFixed(1)}h → last week ${d.lastWeekSleep.toFixed(1)}h`}
          </motion.p>
        </>
      ),
    },
    {
      key: 'milestones',
      node: (
        <>
          <Kicker>Milestones</Kicker>
          <div className="rp-ms">
            {d.milestones.slice(0, 9).map((m, i) => (
              <motion.div key={m.id} className="stack" style={{ alignItems: 'center', gap: 6 }} initial={{ opacity: 0, scale: 0.4, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 200, damping: 14 }}>
                <Emblem milestoneKey={m.key} size={64} />
                <span style={{ fontSize: 11, fontWeight: 650, textAlign: 'center' }}>{MILESTONE_BY_KEY[m.key]?.title}</span>
              </motion.div>
            ))}
          </div>
          {d.milestones.length === 0 && <motion.p className="rp-sub" {...rise(0.4)}>Every recorded day still counted.</motion.p>}
        </>
      ),
    },
  ];
  if (photos.before && photos.after) {
    slides.push({
      key: 'photos',
      node: (
        <>
          <Kicker>Before · after</Kicker>
          <div className="rp-photos">
            {[
              [photos.before, photos.beforeDate],
              [photos.after, photos.afterDate],
            ].map(([src, date], i) => (
              <motion.figure key={i} initial={{ opacity: 0, x: i ? 40 : -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.4, duration: 0.8 }}>
                <img src={src} alt={i ? 'After' : 'Before'} />
                <figcaption>{date && formatShort(date)}</figcaption>
              </motion.figure>
            ))}
          </div>
        </>
      ),
    });
  }
  const complete = d.lockIn.status === 'completed';
  slides.push({
    key: 'final',
    node: (
      <>
        {!prefersReducedMotion() && <ParticleField mode="burst" count={90} />}
        <motion.div initial={{ scale: 0.3, opacity: 0, rotate: -40 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }}>
          <Emblem milestoneKey={complete ? 'lockin-complete' : 'halfway'} size={140} />
        </motion.div>
        <Kicker delay={0.4}>Lock In</Kicker>
        <motion.h1 className="rp-title" {...rise(0.7)}>
          {complete ? 'COMPLETE' : `DAY ${d.elapsedDays}`}
        </motion.h1>
        <motion.p className="rp-sub" {...rise(1)}>
          {d.lockIn.name} · {formatDate(d.lockIn.targetDate)}
        </motion.p>
      </>
    ),
  });
  return slides;
}

export function Replay({ lockInId, onClose }: { lockInId: string; onClose: () => void }) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [stage, setStage] = useState<'setup' | 'play'>('setup');
  const [withPhotos, setWithPhotos] = useState(false);
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [fullUrls, setFullUrls] = useState<{ before?: string; after?: string }>({});
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);

  useEffect(() => {
    loadReplayData(lockInId).then(setData);
    db.photos
      .where('lockInId')
      .equals(lockInId)
      .sortBy('date')
      .then((ps) => {
        setPhotos(ps);
        const front = ps.filter((p) => p.angle === 'front');
        const pool = front.length >= 2 ? front : ps;
        if (pool.length >= 2) {
          setBeforeId(pool[0].id);
          setAfterId(pool[pool.length - 1].id);
        }
      });
  }, [lockInId]);

  useEffect(() => {
    if (!withPhotos || !beforeId || !afterId) return setFullUrls({});
    Promise.all([db.photoBlobs.get(beforeId), db.photoBlobs.get(afterId)]).then(([b, a]) =>
      setFullUrls({ before: b ? imageUrl(`full:${beforeId}`, b.data) : undefined, after: a ? imageUrl(`full:${afterId}`, a.data) : undefined }),
    );
  }, [withPhotos, beforeId, afterId]);

  const before = photos.find((p) => p.id === beforeId);
  const after = photos.find((p) => p.id === afterId);
  const slides = useMemo(
    () => (data ? buildSlides(data, withPhotos ? { ...fullUrls, beforeDate: before?.date, afterDate: after?.date } : {}) : []),
    [data, withPhotos, fullUrls, before?.date, after?.date],
  );

  const progressRef = useRef(0);
  useEffect(() => {
    if (stage !== 'play' || paused || exporting !== null) return;
    let raf = 0;
    const startAt = performance.now() - progressRef.current * SLIDE_MS;
    const tick = (now: number) => {
      const p = (now - startAt) / SLIDE_MS;
      if (p >= 1) {
        progressRef.current = index < slides.length - 1 ? 0 : 1;
        setProgress(progressRef.current);
        if (index < slides.length - 1) setIndex(index + 1);
        return;
      }
      progressRef.current = p;
      setProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, paused, index, slides.length, exporting]);

  const go = (d: number) => {
    progressRef.current = 0;
    setProgress(0);
    setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + d)));
  };

  const exportVideo = async () => {
    if (!data) return;
    setExporting(0);
    try {
      const blob = await renderReplayVideo(data, withPhotos ? fullUrls : {}, (p) => setExporting(p));
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `tgli-replay-${data.lockIn.name.replace(/\W+/g, '-').toLowerCase()}.${ext}`, { type: blob.type });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Transformation Replay' });
        } catch {
          /* user cancelled */
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      toast('Replay video ready', { tone: 'success' });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create the video.', { tone: 'error' });
    }
    setExporting(null);
  };

  return createPortal(
    <motion.div className="rp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Transformation Replay">
      <div className="rp__bg" />
      {stage === 'setup' || !data ? (
        <div className="rp-setup">
          <div className="row between">
            <span className="t-eyebrow">Transformation replay</span>
            <IconButton label="Close" onClick={onClose}>
              <X />
            </IconButton>
          </div>
          <h2 className="t-h1" style={{ marginTop: 18 }}>
            {data?.lockIn.name ?? 'Loading…'}
          </h2>
          <p className="t-small" style={{ marginTop: 8 }}>
            A cinematic look back. It stays private on this device unless you export it.
          </p>
          <div className="panel panel--tight" style={{ marginTop: 22 }}>
            <div className="row gap-3">
              <div className="stack grow">
                <span className="t-h3" style={{ fontSize: 15 }}>
                  Include progress photos
                </span>
                <span className="t-small">{photos.length >= 2 ? 'Off by default. Choose exactly which two to show.' : 'Needs at least two photos.'}</span>
              </div>
              <Toggle label="Include photos" checked={withPhotos} disabled={photos.length < 2} onChange={setWithPhotos} />
            </div>
            {withPhotos && (
              <div className="stack gap-3" style={{ marginTop: 14 }}>
                {(['before', 'after'] as const).map((k) => (
                  <div key={k}>
                    <span className="t-eyebrow">{k}</span>
                    <div className="studio-strip" style={{ marginTop: 6 }}>
                      {photos.map((p) => (
                        <button key={p.id} className="studio-strip__item" data-sel={(k === 'before' ? beforeId : afterId) === p.id} onClick={() => (k === 'before' ? setBeforeId(p.id) : setAfterId(p.id))}>
                          <img src={imageUrl(`thumb:${p.id}`, p.thumb)} alt={formatDate(p.date)} />
                          <span className="studio-strip__date">{formatShort(p.date)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="stack gap-2" style={{ marginTop: 'auto' }}>
            <Button size="lg" block icon={<Play />} disabled={!data} onClick={() => setStage('play')}>
              Play replay
            </Button>
            <span className="row gap-2 t-small" style={{ justifyContent: 'center', fontSize: 12 }}>
              <Lock size={13} /> Private · nothing leaves your device
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="rp-bars">
            {slides.map((s, i) => (
              <span key={s.key}>
                <i style={{ transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})` }} />
              </span>
            ))}
          </div>
          <div className="rp-top">
            <IconButton label={paused ? 'Play' : 'Pause'} size="sm" variant="plain" onClick={() => setPaused(!paused)}>
              {paused ? <Play /> : <Pause />}
            </IconButton>
            <IconButton label="Close replay" size="sm" variant="plain" onClick={onClose}>
              <X />
            </IconButton>
          </div>
          <div
            className="rp-stage"
            onPointerDown={() => {
              held.current = false;
              holdTimer.current = setTimeout(() => {
                held.current = true;
                setPaused(true);
              }, 280);
            }}
            onPointerUp={(e) => {
              clearTimeout(holdTimer.current);
              if (held.current) {
                setPaused(false);
                return;
              }
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              go(e.clientX - r.left < r.width * 0.3 ? -1 : 1);
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div key={slides[index]?.key} className="rp-slide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.45 }}>
                {slides[index]?.node}
              </motion.div>
            </AnimatePresence>
          </div>
          {index === slides.length - 1 && (
            <motion.div className="rp-actions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }}>
              {videoSupported() && (
                <Button variant="secondary" block icon={<Film />} loading={exporting !== null} onClick={exportVideo}>
                  {exporting !== null ? `Rendering ${Math.round(exporting * 100)}%` : 'Export as video'}
                </Button>
              )}
              <Button block onClick={onClose}>
                Done
              </Button>
            </motion.div>
          )}
        </>
      )}
    </motion.div>,
    document.body,
  );
}
