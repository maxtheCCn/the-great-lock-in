/**
 * Custom SVG charts. Missing values are drawn as gaps / hatched bars —
 * never interpolated or shown as zero.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Point {
  x: string;
  y: number | null;
}

function niceDomain(values: number[], pad = 0.12, floor?: number, ceil?: number): [number, number] {
  if (!values.length) return [floor ?? 0, ceil ?? 1];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  lo = floor !== undefined ? Math.min(floor, lo - span * pad) : lo - span * pad;
  hi = ceil !== undefined ? Math.max(ceil, hi + span * pad) : hi + span * pad;
  return [lo, hi];
}

/** Splits a series into contiguous runs so gaps stay visible. */
function segments(points: { px: number; py: number | null }[]) {
  const out: { px: number; py: number }[][] = [];
  let cur: { px: number; py: number }[] = [];
  for (const p of points) {
    if (p.py === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push({ px: p.px, py: p.py });
  }
  if (cur.length) out.push(cur);
  return out;
}

const pathOf = (seg: { px: number; py: number }[]) => seg.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join('');

interface LineChartProps {
  data: Point[];
  overlay?: Point[];
  height?: number;
  unit?: string;
  digits?: number;
  band?: [number, number];
  bandLabel?: string;
  floor?: number;
  ceil?: number;
  formatX?: (x: string) => string;
  formatTip?: (p: Point) => ReactNode;
  showDots?: boolean;
  emptyLabel?: string;
}

export function LineChart({ data, overlay, height = 200, unit = '', digits = 1, band, bandLabel, floor, ceil, formatX = (x) => x, formatTip, showDots, emptyLabel = 'No data recorded yet' }: LineChartProps) {
  const id = useId().replace(/:/g, '');
  const W = 340;
  const H = height;
  const P = { l: 30, r: 10, t: 14, b: 24 };
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const values = data.map((d) => d.y).filter((v): v is number => v !== null);
  const [lo, hi] = niceDomain([...values, ...(band ?? [])], 0.12, floor, ceil);
  const n = Math.max(1, data.length - 1);
  const sx = (i: number) => P.l + (i / n) * (W - P.l - P.r);
  const sy = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);

  const pts = data.map((d, i) => ({ px: sx(i), py: d.y === null ? null : sy(d.y) }));
  const segs = segments(pts);
  const oSegs = overlay ? segments(overlay.map((d, i) => ({ px: sx(i), py: d.y === null ? null : sy(d.y) }))) : [];
  const ticks = useMemo(() => {
    const step = (hi - lo) / 3;
    return [0, 1, 2, 3].map((k) => lo + step * k);
  }, [lo, hi]);
  const xLabels = data.length > 1 ? [0, Math.floor(data.length / 2), data.length - 1] : [0];

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((x - P.l) / (W - P.l - P.r)) * n);
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  if (!values.length) {
    return (
      <div style={{ height: H, display: 'grid', placeItems: 'center', borderRadius: 16, background: 'repeating-linear-gradient(135deg, rgba(160,245,184,0.025) 0 8px, transparent 8px 16px)' }}>
        <span className="t-small">{emptyLabel}</span>
      </div>
    );
  }

  const h = hover !== null ? data[hover] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', touchAction: 'pan-y', overflow: 'visible' }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Chart with ${values.length} recorded values`}
      >
        <defs>
          <linearGradient id={`la-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#37d978" stopOpacity="0.28" />
            <stop offset="1" stopColor="#37d978" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`ls-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2fcb6e" />
            <stop offset="1" stopColor="#c9fcd7" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} stroke="rgba(160,245,184,0.06)" strokeDasharray={i ? '2 4' : undefined} />
            <text x={P.l - 6} y={sy(t) + 3} textAnchor="end" fontSize="9" fill="#63766a" fontFamily="var(--font-mono)">
              {t.toFixed(t % 1 && hi - lo < 6 ? 1 : 0)}
            </text>
          </g>
        ))}
        {band && (
          <g>
            <rect x={P.l} width={W - P.l - P.r} y={sy(band[1])} height={Math.max(0, sy(band[0]) - sy(band[1]))} fill="rgba(160,245,184,0.05)" />
            {bandLabel && (
              <text x={W - P.r - 4} y={sy(band[1]) + 11} textAnchor="end" fontSize="8.5" fill="#63766a" fontFamily="var(--font-mono)">
                {bandLabel}
              </text>
            )}
          </g>
        )}
        {segs.map((seg, i) =>
          seg.length > 1 ? (
            <motion.path
              key={`a${i}`}
              d={`${pathOf(seg)}L${seg[seg.length - 1].px},${H - P.b}L${seg[0].px},${H - P.b}Z`}
              fill={`url(#la-${id})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            />
          ) : null,
        )}
        {oSegs.map((seg, i) => (
          <motion.path
            key={`o${i}`}
            d={pathOf(seg)}
            fill="none"
            stroke="rgba(245,255,247,0.55)"
            strokeWidth="1.4"
            strokeDasharray="3 3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          />
        ))}
        {segs.map((seg, i) => (
          <motion.path
            key={`l${i}`}
            d={pathOf(seg)}
            fill="none"
            stroke={`url(#ls-${id})`}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
            style={{ filter: 'drop-shadow(0 0 5px rgba(55,217,120,0.45))' }}
          />
        ))}
        {(showDots || data.length <= 20) &&
          pts.map((p, i) =>
            p.py === null ? null : <motion.circle key={i} cx={p.px} cy={p.py} r={2.4} fill="#c9fcd7" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 + i * 0.015 }} />,
          )}
        {xLabels.map((i) => (
          <text key={i} x={sx(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="9" fill="#63766a" fontFamily="var(--font-mono)">
            {formatX(data[i].x)}
          </text>
        ))}
        {hover !== null && (
          <g>
            <line x1={sx(hover)} x2={sx(hover)} y1={P.t} y2={H - P.b} stroke="rgba(160,245,184,0.35)" strokeWidth="1" />
            {data[hover].y !== null && <circle cx={sx(hover)} cy={sy(data[hover].y!)} r="5" fill="#0a120e" stroke="#a0f5b8" strokeWidth="2" />}
          </g>
        )}
      </svg>
      <AnimatePresence>
        {h && (
          <motion.div
            className="chart-tip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ left: `${(sx(hover!) / W) * 100}%` }}
          >
            {formatTip ? formatTip(h) : (
              <>
                <span className="t-mono">{formatX(h.x)}</span>
                <b>{h.y === null ? 'Not recorded' : `${h.y.toFixed(digits)}${unit}`}</b>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface Bar {
  key: string;
  label: string;
  value: number | null;
  sub?: string;
  highlight?: boolean;
}

export function BarChart({ data, height = 170, unit = '', digits = 1, target, targetLabel, ceil }: { data: Bar[]; height?: number; unit?: string; digits?: number; target?: number; targetLabel?: string; ceil?: number }) {
  const id = useId().replace(/:/g, '');
  const [sel, setSel] = useState<number | null>(null);
  const vals = data.map((d) => d.value).filter((v): v is number => v !== null);
  const max = Math.max(ceil ?? 0, target ?? 0, ...vals, 1) * 1.12;
  const W = 340;
  const H = height;
  const P = { l: 4, r: 4, t: 18, b: 22 };
  const bw = (W - P.l - P.r) / Math.max(1, data.length);
  const sy = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const s = sel !== null ? data[sel] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="Bar chart">
        <defs>
          <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9fcd7" />
            <stop offset="1" stopColor="#1f9d55" />
          </linearGradient>
          <pattern id={`hatch-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(160,245,184,0.15)" strokeWidth="2" />
          </pattern>
        </defs>
        {target !== undefined && (
          <g>
            <line x1={P.l} x2={W - P.r} y1={sy(target)} y2={sy(target)} stroke="rgba(160,245,184,0.4)" strokeDasharray="4 4" />
            {targetLabel && (
              <text x={W - P.r} y={sy(target) - 5} textAnchor="end" fontSize="9" fill="#98ad9f" fontFamily="var(--font-mono)">
                {targetLabel}
              </text>
            )}
          </g>
        )}
        {data.map((d, i) => {
          const x = P.l + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const isSel = sel === i;
          return (
            <g key={d.key} onClick={() => setSel(isSel ? null : i)} style={{ cursor: 'pointer' }}>
              <rect x={P.l + i * bw} y={P.t} width={bw} height={H - P.t - P.b} fill="transparent" />
              {d.value === null ? (
                <rect x={x} y={H - P.b - 26} width={w} height={26} rx={Math.min(6, w / 2)} fill={`url(#hatch-${id})`} stroke="rgba(160,245,184,0.1)" />
              ) : (
                <motion.rect
                  x={x}
                  width={w}
                  rx={Math.min(6, w / 2)}
                  fill={d.highlight || isSel ? `url(#bg-${id})` : 'rgba(160,245,184,0.32)'}
                  initial={{ y: H - P.b, height: 0 }}
                  animate={{ y: sy(d.value), height: Math.max(2, H - P.b - sy(d.value)) }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  style={{ filter: d.highlight || isSel ? 'drop-shadow(0 0 8px rgba(55,217,120,0.5))' : undefined }}
                />
              )}
              <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize="9" fill={d.highlight ? '#a0f5b8' : '#63766a'} fontFamily="var(--font-mono)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <AnimatePresence>
        {s && (
          <motion.div className="chart-tip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ left: `${((P.l + (sel! + 0.5) * bw) / W) * 100}%` }}>
            <span className="t-mono">{s.sub ?? s.label}</span>
            <b>{s.value === null ? 'No data' : `${s.value.toFixed(digits)}${unit}`}</b>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sparkline({ values, width = 90, height = 30, fluid }: { values: (number | null)[]; width?: number; height?: number; fluid?: boolean }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return <div style={{ width: fluid ? '100%' : width, height }} />;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => ({ px: (i / (values.length - 1)) * width, py: v === null ? null : height - 3 - ((v - lo) / span) * (height - 6) }));
  return (
    <svg
      width={fluid ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? 'none' : undefined}
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      {segments(pts).map((seg, i) => (
        <path key={i} d={pathOf(seg)} fill="none" stroke="#a0f5b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
