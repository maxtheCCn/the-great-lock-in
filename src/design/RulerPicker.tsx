import { useEffect, useLayoutEffect, useRef } from 'react';
import { vibrate } from '@/services/platform';

interface Props {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Fires only after the user interacts, never on mount. */
  onChange: (v: number) => void;
  majorEvery?: number;
  label: string;
  format?: (v: number) => string;
}

const TICK = 14;

/** Horizontal, momentum-scrolling ruler (native scroll-snap). */
export function RulerPicker({ value, min, max, step, onChange, majorEvery = 4, label, format = (v) => String(v) }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const interacted = useRef(false);
  const last = useRef(value);
  const raf = useRef(0);
  const count = Math.round((max - min) / step) + 1;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = Math.round((value - min) / step) * TICK;
    if (Math.abs(el.scrollLeft - target) > 2 && !interacted.current) el.scrollLeft = target;
    last.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onScroll = () => {
    if (!interacted.current) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / TICK)));
      const v = Math.round((min + idx * step) * 100) / 100;
      if (v !== last.current) {
        last.current = v;
        if (idx % majorEvery === 0) vibrate(4);
        onChange(v);
      }
    });
  };

  const mark = () => {
    interacted.current = true;
  };

  const nudge = (dir: number) => {
    interacted.current = true;
    const v = Math.min(max, Math.max(min, Math.round((value + dir * step) * 100) / 100));
    ref.current?.scrollTo({ left: ((v - min) / step) * TICK, behavior: 'smooth' });
    onChange(v);
  };

  return (
    <div className="ruler">
      <div
        ref={ref}
        className="ruler__track"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        onScroll={onScroll}
        onPointerDown={mark}
        onTouchStart={mark}
        onWheel={mark}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            nudge(1);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            nudge(-1);
          }
        }}
      >
        <div className="ruler__ticks" style={{ width: count * TICK }}>
          {Array.from({ length: count }, (_, i) => {
            const major = i % majorEvery === 0;
            const mid = !major && i % (majorEvery / 2) === 0;
            return (
              <span key={i} className={`ruler__tick ${major ? 'is-major' : mid ? 'is-mid' : ''}`} style={{ width: TICK }}>
                {major && <em>{Math.round(min + i * step)}</em>}
              </span>
            );
          })}
        </div>
      </div>
      <div className="ruler__needle" aria-hidden />
    </div>
  );
}
