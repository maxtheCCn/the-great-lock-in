import { useId } from 'react';
import { MILESTONE_BY_KEY } from '@/domain/milestones';
import { MILESTONE_ICONS } from './icons';

const HEX = (r: number, c = 50) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${c + Math.cos(a) * r},${c + Math.sin(a) * r}`;
  }).join(' ');

/** Hexagonal milestone badge. Locked badges render as dim outlines. */
export function Emblem({ milestoneKey, size = 64, locked = false }: { milestoneKey: string; size?: number; locked?: boolean }) {
  const def = MILESTONE_BY_KEY[milestoneKey];
  const id = useId().replace(/:/g, '');
  if (!def) return null;
  const Icon = MILESTONE_ICONS[def.icon];
  const tier = def.tier;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} aria-hidden>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`em-f-${id}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor={locked ? '#18201b' : tier === 3 ? '#2e6b45' : '#21452f'} />
            <stop offset="1" stopColor={locked ? '#0c100e' : '#0a1610'} />
          </linearGradient>
          <linearGradient id={`em-s-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={locked ? '#2c3830' : '#e6ffed'} />
            <stop offset="0.5" stopColor={locked ? '#222b25' : '#a0f5b8'} />
            <stop offset="1" stopColor={locked ? '#1a211d' : '#2fcb6e'} />
          </linearGradient>
          <filter id={`em-g-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {!locked && tier >= 2 && <polygon points={HEX(48)} fill="none" stroke="#37d978" strokeOpacity="0.5" strokeWidth="6" filter={`url(#em-g-${id})`} />}
        {!locked && tier === 3 &&
          Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="50" y1="-2" x2="50" y2="6" stroke="#a0f5b8" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${i * 30} 50 50)`} />
          ))}
        <polygon points={HEX(44)} fill={`url(#em-f-${id})`} stroke={`url(#em-s-${id})`} strokeWidth={locked ? 1.5 : 2.5} strokeLinejoin="round" />
        {tier >= 2 && <polygon points={HEX(36)} fill="none" stroke={locked ? '#26302a' : 'rgba(160,245,184,0.35)'} strokeWidth="1" strokeLinejoin="round" />}
        {!locked && <polygon points={HEX(44)} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="0 69 69 200" />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: locked ? '#3c4a41' : '#d8ffe3' }}>
        <Icon style={{ width: size * 0.34, height: size * 0.34, filter: locked ? undefined : 'drop-shadow(0 0 6px rgba(55,217,120,0.7))' }} strokeWidth={1.8} />
      </div>
    </div>
  );
}
