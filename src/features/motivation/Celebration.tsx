import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/design/primitives';
import { prefersReducedMotion } from '@/design/visuals';
import { Emblem } from '@/components/Emblem';
import { ParticleField } from '@/components/ParticleField';
import { MILESTONE_BY_KEY } from '@/domain/milestones';
import { db } from '@/data/db';
import { markMilestonesSeen } from '@/data/repo';
import { useUI } from '@/state/ui';
import { vibrate } from '@/services/platform';
import './celebration.css';

export function CelebrationHost({ lockInId }: { lockInId: string }) {
  const queue = useUI((s) => s.celebrations);
  const shift = useUI((s) => s.shiftCelebration);
  const enqueue = useUI((s) => s.enqueueCelebrations);
  const sheetOpen = useUI((s) => s.sheet !== null);
  const key = queue[0];
  const def = key ? MILESTONE_BY_KEY[key] : undefined;
  const reduce = prefersReducedMotion();

  // Milestones earned but never shown (e.g. app closed mid-celebration).
  useEffect(() => {
    db.milestones
      .where('lockInId')
      .equals(lockInId)
      .filter((m) => !m.seen)
      .toArray()
      .then((rows) => rows.length && enqueue(rows.sort((a, b) => a.achievedAt - b.achievedAt).map((r) => r.key)));
  }, [lockInId, enqueue]);

  useEffect(() => {
    if (def && !sheetOpen) vibrate([20, 40, 80]);
  }, [def, sheetOpen]);

  const next = async () => {
    if (key) await markMilestonesSeen(lockInId, [key]);
    shift();
  };

  return createPortal(
    <AnimatePresence>
      {def && !sheetOpen && (
        <motion.div
          key={key}
          className="celebrate"
          role="dialog"
          aria-modal="true"
          aria-label={`Milestone unlocked: ${def.title}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          transition={{ duration: 0.4 }}
        >
          {!reduce && <div className="celebrate__rays" />}
          <div className="celebrate__vignette" />
          {!reduce && <ParticleField mode="burst" count={80} intensity={def.tier === 3 ? 1.5 : 1} />}
          <div className="celebrate__content">
            <div className="celebrate__emblem">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="celebrate__pulse"
                  initial={{ scale: 0.4, opacity: 0.8 }}
                  animate={{ scale: 2.6, opacity: 0 }}
                  transition={{ delay: 0.25 + i * 0.35, duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}
              <motion.div
                initial={{ scale: 0.2, rotate: -40, opacity: 0, filter: 'blur(12px)' }}
                animate={{ scale: 1, rotate: 0, opacity: 1, filter: 'blur(0px)' }}
                transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.1 }}
              >
                <Emblem milestoneKey={def.key} size={150} />
              </motion.div>
            </div>
            <motion.div className="t-kicker celebrate__kicker" initial={{ opacity: 0, letterSpacing: '0.6em' }} animate={{ opacity: 1, letterSpacing: '0.28em' }} transition={{ delay: 0.5, duration: 1 }}>
              Milestone unlocked
            </motion.div>
            <h2 className="celebrate__title" aria-hidden>
              {def.title.split(' ').map((w, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.7 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w}&nbsp;
                </motion.span>
              ))}
            </h2>
            <motion.p className="celebrate__desc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
              {def.description}
            </motion.p>
            <motion.div className="celebrate__cta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}>
              <Button size="lg" block onClick={next}>
                {queue.length > 1 ? `Next (${queue.length - 1} more)` : 'Continue'}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
