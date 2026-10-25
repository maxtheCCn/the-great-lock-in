import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ParticleField } from '@/components/ParticleField';
import { prefersReducedMotion } from '@/design/visuals';
import { vibrate } from '@/services/platform';

/** Cinematic "3 · 2 · 1 · YOU ARE NOW LOCKED IN." sequence. */
export function Activation({ name, onDone }: { name: string; onDone: () => void }) {
  const reduce = prefersReducedMotion();
  const [phase, setPhase] = useState<number>(reduce ? 0 : 3);

  useEffect(() => {
    if (reduce) {
      const t = setTimeout(onDone, 1800);
      return () => clearTimeout(t);
    }
    vibrate(30);
    const ts = [
      setTimeout(() => (setPhase(2), vibrate(30)), 1000),
      setTimeout(() => (setPhase(1), vibrate(30)), 2000),
      setTimeout(() => (setPhase(0), vibrate([60, 40, 120])), 3000),
      setTimeout(onDone, 5900),
    ];
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <motion.div className="activation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} role="status" aria-live="assertive">
      <div className="activation__lines" />
      <AnimatePresence>
        {phase > 0 && (
          <motion.div
            key={`ring-${phase}`}
            className="activation__ring"
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 3.2, opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase > 0 && (
          <motion.div
            key={phase}
            className="activation__count"
            initial={{ opacity: 0, scale: 1.7, filter: 'blur(24px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.7, filter: 'blur(14px)' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {phase}
          </motion.div>
        )}
      </AnimatePresence>
      {phase === 0 && (
        <>
          {!reduce && (
            <>
              <motion.div className="activation__burst" initial={{ scale: 0, opacity: 1 }} animate={{ scale: 5, opacity: 0 }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} />
              <motion.div className="activation__ring" initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 4.5, opacity: 0 }} transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }} />
              <ParticleField mode="burst" count={110} intensity={1.4} />
            </>
          )}
          <div className="activation__final">
            <motion.div className="activation__small" initial={{ opacity: 0, letterSpacing: '0.9em' }} animate={{ opacity: 1, letterSpacing: '0.4em' }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}>
              YOU ARE NOW
            </motion.div>
            <motion.div
              className="activation__big"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(18px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              LOCKED
              <br />
              IN.
            </motion.div>
            <motion.div className="activation__name" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.7 }}>
              {name}
            </motion.div>
          </div>
        </>
      )}
    </motion.div>,
    document.body,
  );
}
