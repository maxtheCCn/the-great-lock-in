import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/design/visuals';

interface Props {
  count?: number;
  /** 'drift' floats upward slowly; 'burst' explodes outward once from the centre. */
  mode?: 'drift' | 'burst';
  className?: string;
  style?: React.CSSProperties;
  intensity?: number;
}

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  life: number;
  tw: number;
}

/** Lightweight canvas particles. Pauses when hidden; disabled for reduced motion. */
export function ParticleField({ count = 60, mode = 'drift', className, style, intensity = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || prefersReducedMotion() || document.documentElement.dataset.effects === 'reduced') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const spawn = (initial: boolean): P => {
      if (mode === 'burst') {
        const ang = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 6 * intensity;
        return { x: w / 2, y: h / 2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 0.6 + Math.random() * 2.2, a: 1, life: 1, tw: Math.random() * 6 };
      }
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + 10,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -(0.12 + Math.random() * 0.45) * intensity,
        r: 0.4 + Math.random() * 1.6,
        a: 0.15 + Math.random() * 0.6,
        life: 1,
        tw: Math.random() * 6,
      };
    };
    // Pre-rendered glow sprite: far cheaper than canvas shadowBlur per particle.
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 32;
    const sctx = sprite.getContext('2d')!;
    const g = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(225,255,233,1)');
    g.addColorStop(0.25, 'rgba(160,245,184,0.85)');
    g.addColorStop(0.6, 'rgba(55,217,120,0.18)');
    g.addColorStop(1, 'rgba(55,217,120,0)');
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 32, 32);

    const ps: P[] = Array.from({ length: count }, () => spawn(true));
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.x += p.vx;
        p.y += p.vy;
        if (mode === 'burst') {
          p.vx *= 0.965;
          p.vy *= 0.965;
          p.life -= 0.011;
          if (p.life <= 0) continue;
        } else if (p.y < -10) {
          ps[i] = spawn(false);
          continue;
        }
        const twinkle = 0.65 + 0.35 * Math.sin(t * 2 + p.tw);
        ctx.globalAlpha = p.a * twinkle * (mode === 'burst' ? p.life : 1);
        const s = p.r * 7;
        ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      if (mode === 'burst' && ps.every((p) => p.life <= 0)) return;
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [count, mode, intensity]);

  return <canvas ref={ref} className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...style }} aria-hidden />;
}
