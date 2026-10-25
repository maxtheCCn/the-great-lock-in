import { animate, motion } from 'motion/react';
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return document.documentElement.dataset.effects === 'minimal' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Counts smoothly to `value`. Mutates text directly so it never re-renders React per frame. */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1.2,
  className,
  format,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  format?: (v: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const fmt = (v: number) => (format ? format(v) : v.toFixed(decimals));

  useLayoutEffect(() => {
    if (ref.current && !ref.current.textContent) ref.current.textContent = fmt(prefersReducedMotion() ? value : prev.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prev.current;
    prev.current = value;
    if (prefersReducedMotion() || from === value) {
      node.textContent = fmt(value);
      return;
    }
    const c = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = fmt(v);
      },
    });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);

  return <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }} />;
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  children,
  color,
  track = 'rgba(160,245,184,0.08)',
  delay = 0,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  color?: string;
  track?: string;
  delay?: number;
}) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`rg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d6ffe1" />
            <stop offset="1" stopColor="#2fcb6e" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? `url(#rg-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: v === 0 ? 0.0001 : v }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay }}
          style={{ filter: v > 0 ? 'drop-shadow(0 0 6px rgba(55,217,120,0.45))' : undefined, opacity: v === 0 ? 0 : 1 }}
        />
      </svg>
      {children && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>}
    </div>
  );
}

/** Page sections render in place; the route transition is the page's single motion. */
export const enterParent = { hidden: {}, show: {} };
export const enterChild = { hidden: {}, show: {} };

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
