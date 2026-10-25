import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CheckIn, LockIn } from '@/data/types';
import { addDays, diffDays, formatDate } from '@/domain/dates';
import { lockInTimeline, splitDuration, type Timeline } from '@/domain/timeline';
import { AnimatedNumber } from '@/design/visuals';
import { useNow } from '@/hooks/useNow';
import { RATING_COLOR } from '@/components/ratings';

const C = 170;
const pad = (n: number) => String(n).padStart(2, '0');

function Clock({ endMs, startMs, phase }: { endMs: number; startMs: number; phase: Timeline['phase'] }) {
  const now = useNow(1000);
  if (phase === 'ended') return <div className="orbit__clock">TARGET REACHED</div>;
  const target = phase === 'upcoming' ? startMs : endMs;
  const d = splitDuration(target - now.getTime());
  return (
    <div className="orbit__clock" aria-label="Time remaining today">
      <span>+</span> {pad(d.hours)}
      <span>:</span>
      {pad(d.minutes)}
      <span>:</span>
      {pad(d.seconds)}
    </div>
  );
}

/**
 * Countdown hero: one tick per Lock In day, coloured by the rating the user chose.
 * The inner arc shows elapsed *time* only — never physical progress.
 */
export function Orbit({ lockIn, checkIns, today }: { lockIn: LockIn; checkIns: CheckIn[]; today: string }) {
  const now = useNow(60_000);
  const t = lockInTimeline(lockIn, now);
  const byDate = useMemo(() => new Map(checkIns.map((c) => [c.date, c])), [checkIns]);

  const total = t.totalDays;
  const step = 360 / total;
  const width = Math.max(1.1, Math.min(4.2, ((2 * Math.PI * 153) / total) * 0.42));
  const tickStep = `${Math.min(14, 1100 / total)}ms`;

  const ticks = useMemo(() => {
    return Array.from({ length: total }, (_, i) => {
      const date = addDays(lockIn.startDate, i);
      const rel = diffDays(today, date);
      const c = byDate.get(date);
      let color = 'rgba(255,255,255,0.06)';
      let r1 = 147;
      if (rel <= 0) {
        if (c?.rating) {
          color = RATING_COLOR[c.rating];
          r1 = 143;
        } else if (c) color = 'rgba(160,245,184,0.5)';
        else color = 'rgba(160,245,184,0.14)';
      }
      const a = ((i + 0.5) * step - 90) * (Math.PI / 180);
      return { i, x1: C + Math.cos(a) * r1, y1: C + Math.sin(a) * r1, x2: C + Math.cos(a) * 161, y2: C + Math.sin(a) * 161, cx: C + Math.cos(a) * 153, cy: C + Math.sin(a) * 153, color, today: rel === 0, rated: !!c?.rating };
    });
  }, [total, step, lockIn.startDate, today, byDate]);

  // A light pulse on today's tick when the day gets its colour (feedback for the check-in).
  const todayTick = ticks.find((k) => k.today);
  const todayRating = byDate.get(today)?.rating ?? null;
  const prevRating = useRef<string | null | undefined>(undefined);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (prevRating.current !== undefined && todayRating && todayRating !== prevRating.current) setPulse((p) => p + 1);
    prevRating.current = todayRating;
  }, [todayRating]);

  const headAngle = (t.elapsed * 360 - 90) * (Math.PI / 180);
  const R = 128;
  const circ = 2 * Math.PI * R;

  return (
    <div>
      <div className="orbit">
        <div className="orbit__glow" />
        <svg viewBox="0 0 340 340" aria-hidden>
          <defs>
            <linearGradient id="orbit-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e2ffe9" />
              <stop offset="0.6" stopColor="#a0f5b8" />
              <stop offset="1" stopColor="#2fcb6e" />
            </linearGradient>
            <radialGradient id="orbit-head">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.35" stopColor="#a0f5b8" />
              <stop offset="1" stopColor="#37d978" stopOpacity="0" />
            </radialGradient>
          </defs>

          {ticks.map((k) => (
            <line
              key={k.i}
              className={`orbit__tick ${k.today ? 'orbit__today' : ''}`}
              style={{ ['--i' as string]: k.i, ['--step' as string]: tickStep }}
              x1={k.x1}
              y1={k.y1}
              x2={k.x2}
              y2={k.y2}
              stroke={k.today && !k.rated ? '#ffffff' : k.color}
              strokeWidth={k.today ? width + 1 : width}
              strokeLinecap="round"
            />
          ))}

          {todayTick && pulse > 0 && (
            <motion.circle
              key={pulse}
              cx={todayTick.cx}
              cy={todayTick.cy}
              r={7}
              fill="none"
              stroke={todayTick.color}
              strokeWidth={2}
              initial={{ scale: 0.4, opacity: 1 }}
              animate={{ scale: 3.4, opacity: 0 }}
              transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${todayTick.cx}px ${todayTick.cy}px`, transformBox: 'view-box' }}
            />
          )}

          <g className="orbit__spin">
            <circle cx={C} cy={C} r="114" fill="none" stroke="rgba(160,245,184,0.12)" strokeWidth="1" strokeDasharray="1 5" />
          </g>
          <g className="orbit__spin orbit__spin--rev">
            {[0, 90, 180, 270].map((deg) => (
              <line key={deg} x1={C} y1={C - 104} x2={C} y2={C - 98} stroke="rgba(160,245,184,0.4)" strokeWidth="1.2" transform={`rotate(${deg} ${C} ${C})`} />
            ))}
          </g>

          <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(160,245,184,0.08)" strokeWidth="3" />
          <motion.circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke="url(#orbit-arc)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circ}
            transform={`rotate(-90 ${C} ${C})`}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ * (1 - t.elapsed) }}
            transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1], delay: 0.2 }}
            style={{ filter: 'drop-shadow(0 0 6px rgba(55,217,120,0.6))' }}
          />
          {t.phase === 'active' && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}>
              <circle cx={C + Math.cos(headAngle) * R} cy={C + Math.sin(headAngle) * R} r="10" fill="url(#orbit-head)" />
              <circle cx={C + Math.cos(headAngle) * R} cy={C + Math.sin(headAngle) * R} r="2.6" fill="#fff" />
            </motion.g>
          )}
        </svg>

        <div className="orbit__center">
          {t.phase === 'upcoming' && (
            <>
              <span className="t-eyebrow">Starts in</span>
              <div className="orbit__days">
                <AnimatedNumber value={t.startsIn} />
              </div>
              <span className="t-eyebrow" style={{ color: 'var(--text-2)' }}>
                {t.startsIn === 1 ? 'day' : 'days'}
              </span>
            </>
          )}
          {t.phase === 'active' && (
            <>
              <span className="t-eyebrow">{t.daysRemaining === 0 ? 'Final day' : 'Days remaining'}</span>
              <div className="orbit__days">
                <AnimatedNumber value={t.daysRemaining} />
              </div>
              <Clock endMs={t.endMs} startMs={t.startMs} phase={t.phase} />
            </>
          )}
          {t.phase === 'ended' && (
            <>
              <span className="t-eyebrow">Lock In</span>
              <div className="orbit__days orbit__days--word">COMPLETE</div>
              <Clock endMs={t.endMs} startMs={t.startMs} phase={t.phase} />
            </>
          )}
        </div>
      </div>

      <div className="orbit-stats">
        <div className="orbit-stats__item">
          <span className="t-eyebrow">Start</span>
          <span className="orbit-stats__value">{formatDate(lockIn.startDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        <div className="orbit-stats__mid">
          <span className="orbit-stats__pct">
            <AnimatedNumber value={t.elapsed * 100} decimals={t.elapsed < 0.1 ? 1 : 0} />
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>%</span>
          </span>
          <div className="orbit-stats__bar">
            <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: t.elapsed }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <span className="t-eyebrow" style={{ fontSize: 11 }}>
            of the time elapsed
          </span>
        </div>
        <div className="orbit-stats__item">
          <span className="t-eyebrow">Target</span>
          <span className="orbit-stats__value">{formatDate(lockIn.targetDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
    </div>
  );
}
