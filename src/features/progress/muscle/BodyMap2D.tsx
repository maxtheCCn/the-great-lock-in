import type { MuscleId } from '@/data/types';
import type { MuscleStat } from '@/domain/analytics';
import { LEVEL_COLORS, levelFor, maxSets } from './intensity';

type Shape =
  | { t: 'e'; cx: number; cy: number; rx: number; ry: number; rot?: number }
  | { t: 'p'; d: string }
  | { t: 'r'; x: number; y: number; w: number; h: number };

const mirrorX = (s: Shape): Shape => {
  if (s.t === 'e') return { ...s, cx: 100 - s.cx, rot: -(s.rot ?? 0) };
  if (s.t === 'r') return { ...s, x: 100 - s.x - s.w };
  // Paths are mirrored via transform at render time.
  return s;
};

interface Region {
  id: MuscleId;
  shapes: Shape[];
  mirror?: boolean;
}

const FRONT: Region[] = [
  { id: 'traps', mirror: true, shapes: [{ t: 'p', d: 'M46.5 30.5 Q39 33.5 33 37.5 L37.5 39.5 Q44 36.5 47.5 35.5 Z' }] },
  { id: 'shoulders', mirror: true, shapes: [{ t: 'e', cx: 28.5, cy: 42, rx: 6.8, ry: 7.6, rot: 18 }] },
  { id: 'chest', mirror: true, shapes: [{ t: 'p', d: 'M49.4 40 Q40 37.5 33.5 45 Q33.5 56.5 41.5 59.5 Q48.5 59.5 49.4 55.5 Z' }] },
  { id: 'biceps', mirror: true, shapes: [{ t: 'e', cx: 24.4, cy: 58, rx: 4.4, ry: 10, rot: 9 }] },
  { id: 'forearms', mirror: true, shapes: [{ t: 'e', cx: 19.5, cy: 91, rx: 4, ry: 12.5, rot: 9 }] },
  {
    id: 'abs',
    shapes: [
      { t: 'r', x: 44.3, y: 62, w: 5.2, h: 7.6 },
      { t: 'r', x: 50.5, y: 62, w: 5.2, h: 7.6 },
      { t: 'r', x: 44.3, y: 70.8, w: 5.2, h: 7.6 },
      { t: 'r', x: 50.5, y: 70.8, w: 5.2, h: 7.6 },
      { t: 'r', x: 44.6, y: 79.6, w: 4.9, h: 7.6 },
      { t: 'r', x: 50.5, y: 79.6, w: 4.9, h: 7.6 },
      { t: 'p', d: 'M45 88.6 L55 88.6 L53.5 99 Q50 101.5 46.5 99 Z' },
    ],
  },
  { id: 'obliques', mirror: true, shapes: [{ t: 'e', cx: 38.6, cy: 79, rx: 3.9, ry: 11.5, rot: -8 }] },
  { id: 'quads', mirror: true, shapes: [{ t: 'e', cx: 41.2, cy: 129, rx: 6.9, ry: 20.5, rot: 4 }] },
  { id: 'calves', mirror: true, shapes: [{ t: 'e', cx: 37.6, cy: 177, rx: 3.2, ry: 12, rot: 3 }] },
];

const BACK: Region[] = [
  { id: 'traps', shapes: [{ t: 'p', d: 'M50 28.5 L35.5 38.5 Q44 44 50 63 Q56 44 64.5 38.5 Z' }] },
  { id: 'shoulders', mirror: true, shapes: [{ t: 'e', cx: 28.5, cy: 42.5, rx: 6.8, ry: 7.4, rot: 18 }] },
  { id: 'lats', mirror: true, shapes: [{ t: 'p', d: 'M37.5 45.5 Q30.5 58 36.5 81 Q44 77.5 48.4 67 Q44.5 54 37.5 45.5 Z' }] },
  { id: 'triceps', mirror: true, shapes: [{ t: 'e', cx: 24.2, cy: 58.5, rx: 4.5, ry: 10.2, rot: 9 }] },
  { id: 'forearms', mirror: true, shapes: [{ t: 'e', cx: 19.5, cy: 91, rx: 4, ry: 12.5, rot: 9 }] },
  { id: 'lowerBack', mirror: true, shapes: [{ t: 'e', cx: 46.3, cy: 87, rx: 3.4, ry: 9.5 }] },
  { id: 'glutes', mirror: true, shapes: [{ t: 'e', cx: 42.4, cy: 108, rx: 7.8, ry: 8.4 }] },
  { id: 'hamstrings', mirror: true, shapes: [{ t: 'e', cx: 41.4, cy: 136, rx: 6.4, ry: 18.5, rot: 3 }] },
  { id: 'calves', mirror: true, shapes: [{ t: 'e', cx: 40.4, cy: 176, rx: 5, ry: 13 }] },
];

function renderShape(s: Shape, key: string, props: React.SVGProps<SVGElement>, mirrorPath = false) {
  if (s.t === 'e')
    return <ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} {...(props as React.SVGProps<SVGEllipseElement>)} />;
  if (s.t === 'r') return <rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={1.6} {...(props as React.SVGProps<SVGRectElement>)} />;
  return <path key={key} d={s.d} transform={mirrorPath ? 'translate(100 0) scale(-1 1)' : undefined} {...(props as React.SVGProps<SVGPathElement>)} />;
}

function Silhouette() {
  const limb = { stroke: '#121a16', strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <g>
      <ellipse cx="50" cy="15.5" rx="8.6" ry="10.6" fill="#121a16" />
      <rect x="45.5" y="24" width="9" height="9" rx="3" fill="#121a16" />
      <path d="M30 36 Q50 30 70 36 L73.5 44 Q70 70 64 92 L66.5 104 Q50 111 33.5 104 L36 92 Q30 70 26.5 44 Z" fill="#121a16" />
      <polyline points="27,42 23.5,62 21,78" {...limb} strokeWidth={10} />
      <polyline points="77,42 76.5,62 79,78" {...limb} strokeWidth={10} />
      <polyline points="21,78 18.5,96 16,110" {...limb} strokeWidth={8} />
      <polyline points="79,78 81.5,96 84,110" {...limb} strokeWidth={8} />
      <ellipse cx="15" cy="116" rx="3.6" ry="5.4" fill="#121a16" />
      <ellipse cx="85" cy="116" rx="3.6" ry="5.4" fill="#121a16" />
      <polyline points="41,104 40.5,132 39.5,158" {...limb} strokeWidth={15} />
      <polyline points="59,104 59.5,132 60.5,158" {...limb} strokeWidth={15} />
      <polyline points="39.5,158 39.5,182 40.5,202" {...limb} strokeWidth={10} />
      <polyline points="60.5,158 60.5,182 59.5,202" {...limb} strokeWidth={10} />
      <ellipse cx="39" cy="208" rx="5.5" ry="3.4" fill="#121a16" />
      <ellipse cx="61" cy="208" rx="5.5" ry="3.4" fill="#121a16" />
    </g>
  );
}

interface Props {
  volume: Record<MuscleId, MuscleStat>;
  side: 'front' | 'back';
  height?: number;
  selected?: MuscleId | null;
  onSelect?: (id: MuscleId) => void;
}

/** Stylised 2D muscle map. Used for previews and as the fallback when WebGL is unavailable. */
export function BodyMap2D({ volume, side, height = 300, selected, onSelect }: Props) {
  const max = maxSets(volume);
  const regions = side === 'front' ? FRONT : BACK;
  return (
    <svg viewBox="0 0 100 214" height={height} style={{ width: 'auto', overflow: 'visible' }} role={onSelect ? 'group' : 'img'} aria-label={`${side} muscle map`}>
      <defs>
        <filter id="bm-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <Silhouette />
      {regions.map((r) => {
        const lvl = levelFor(volume[r.id]?.sets ?? 0, max);
        const color = LEVEL_COLORS[lvl];
        const isSel = selected === r.id;
        const common = {
          fill: color,
          stroke: isSel ? '#ffffff' : 'rgba(160,245,184,0.18)',
          strokeWidth: isSel ? 0.9 : 0.35,
          style: { cursor: onSelect ? 'pointer' : undefined, transition: 'fill 400ms ease' },
        };
        const shapes = r.shapes.flatMap((s, i) => {
          const out = [renderShape(s, `${r.id}-${i}`, common as React.SVGProps<SVGElement>)];
          if (r.mirror) out.push(renderShape(mirrorX(s), `${r.id}-${i}-m`, common as React.SVGProps<SVGElement>, s.t === 'p'));
          return out;
        });
        return (
          <g
            key={r.id}
            onClick={onSelect ? () => onSelect(r.id) : undefined}
            role={onSelect ? 'button' : undefined}
            aria-label={onSelect ? r.id : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onKeyDown={onSelect ? (e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.id) : undefined}
          >
            {lvl >= 2 && <g filter="url(#bm-glow)" opacity={lvl === 3 ? 0.8 : 0.45}>{shapes}</g>}
            {shapes}
          </g>
        );
      })}
    </svg>
  );
}
