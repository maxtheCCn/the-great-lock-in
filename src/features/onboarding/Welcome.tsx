import { motion } from 'motion/react';
import { Lock, ShieldCheck, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/design/primitives';
import { prefersReducedMotion } from '@/design/visuals';
import { ParticleField } from '@/components/ParticleField';

const LINE = 'YOUR JOURNEY STARTS HERE.';
const KEYHOLE = 'M256 158a54 54 0 0 1 30 98.9L302 352a10 10 0 0 1-9.9 11.6h-72.2A10 10 0 0 1 210 352l16-95.1A54 54 0 0 1 256 158z';

function Letters({ text, delay, step = 0.05, className }: { text: string; delay: number; step?: number; className?: string }) {
  return (
    <div className={className} aria-label={text}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ opacity: 0, y: 24, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: delay + i * step, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </div>
  );
}

export function Welcome({ onBegin }: { onBegin: () => void }) {
  const reduce = prefersReducedMotion();
  const [typed, setTyped] = useState(reduce ? LINE.length : 0);
  const [ready, setReady] = useState(reduce);
  const s = reduce ? 0 : 1; // time scale

  useEffect(() => {
    if (reduce) return;
    let i = 0;
    let typer: ReturnType<typeof setInterval> | undefined;
    const startTyping = setTimeout(() => {
      typer = setInterval(() => {
        i++;
        setTyped(i);
        if (i >= LINE.length) clearInterval(typer);
      }, 42);
    }, 3000);
    const cta = setTimeout(() => setReady(true), 4200);
    return () => {
      clearTimeout(startTyping);
      clearTimeout(cta);
      clearInterval(typer);
    };
  }, [reduce]);

  const skip = () => {
    setTyped(LINE.length);
    setReady(true);
  };

  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="welcome" onClick={ready ? undefined : skip}>
      <ParticleField count={70} />
      <div className="welcome__emblem">
        <motion.div className="welcome__halo" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 2.2 * s, ease: 'easeOut' }} />
        <svg viewBox="0 0 240 240" aria-hidden>
          <defs>
            <linearGradient id="w-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e2ffe9" />
              <stop offset="0.5" stopColor="#a0f5b8" />
              <stop offset="1" stopColor="#2fcb6e" />
            </linearGradient>
            <filter id="w-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          {ticks.map((i) => {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const major = i % 5 === 0;
            const r1 = major ? 110 : 113;
            return (
              <motion.line
                key={i}
                x1={120 + Math.cos(a) * r1}
                y1={120 + Math.sin(a) * r1}
                x2={120 + Math.cos(a) * 118}
                y2={120 + Math.sin(a) * 118}
                stroke={major ? '#a0f5b8' : 'rgba(160,245,184,0.35)'}
                strokeWidth={major ? 1.6 : 1}
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: (0.2 + i * 0.02) * s, duration: 0.3 }}
              />
            );
          })}
          <circle cx="120" cy="120" r="96" fill="none" stroke="rgba(160,245,184,0.1)" strokeWidth="8" />
          <g transform="rotate(-90 120 120)">
            <motion.circle
              cx="120"
              cy="120"
              r="96"
              fill="none"
              stroke="#37d978"
              strokeOpacity="0.6"
              strokeWidth="8"
              strokeLinecap="round"
              filter="url(#w-glow)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 0.83 }}
              transition={{ delay: 0.2 * s, duration: 1.8 * s, ease: [0.65, 0, 0.35, 1] }}
            />
            <motion.circle
              cx="120"
              cy="120"
              r="96"
              fill="none"
              stroke="url(#w-arc)"
              strokeWidth="8"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 0.83 }}
              transition={{ delay: 0.2 * s, duration: 1.8 * s, ease: [0.65, 0, 0.35, 1] }}
            />
          </g>
          <motion.circle
            cx="120"
            cy="120"
            r="78"
            fill="none"
            stroke="rgba(160,245,184,0.18)"
            strokeWidth="1"
            strokeDasharray="2 6"
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: 1, rotate: 360 }}
            transition={{ opacity: { delay: 0.8 * s, duration: 1 }, rotate: { duration: 60, repeat: Infinity, ease: 'linear' } }}
            style={{ transformOrigin: '120px 120px' }}
          />
          <motion.g
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 * s, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: '120px 120px' }}
          >
            <g transform="translate(120 122) scale(0.36) translate(-256 -261)">
              <path d={KEYHOLE} fill="#37d978" filter="url(#w-glow)" opacity="0.7" />
              <path d={KEYHOLE} fill="#e9fff0" />
            </g>
          </motion.g>
        </svg>
        {!reduce && (
          <motion.div
            className="welcome__scan"
            initial={{ top: '0%', opacity: 0 }}
            animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
            transition={{ delay: 1.6, duration: 1.3, ease: 'easeInOut' }}
          />
        )}
      </div>

      <Letters text="THE GREAT" delay={1.9 * s} step={0.05 * s} className="welcome__kicker" />
      <Letters text="LOCK IN" delay={2.2 * s} step={0.07 * s} className="welcome__title" />
      <div className="welcome__line" aria-label={LINE}>
        <span aria-hidden>{LINE.slice(0, typed)}</span>
        {typed > 0 && <span className="welcome__caret" aria-hidden />}
      </div>

      <motion.div
        className="welcome__cta"
        initial={{ opacity: 0, y: 20 }}
        animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ pointerEvents: ready ? 'auto' : 'none' }}
      >
        <Button size="lg" block onClick={onBegin}>
          Begin your Lock In
        </Button>
        <div className="welcome__foot">
          <span>
            <Lock /> Private
          </span>
          <span>
            <WifiOff /> Works offline
          </span>
          <span>
            <ShieldCheck /> No account
          </span>
        </div>
      </motion.div>
    </div>
  );
}
