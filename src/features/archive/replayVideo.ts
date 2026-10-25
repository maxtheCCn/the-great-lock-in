/**
 * Renders a simplified Transformation Replay to a video entirely on-device
 * (canvas + MediaRecorder). Nothing is uploaded.
 */
import { formatDate, formatRange } from '@/domain/dates';
import { MILESTONE_BY_KEY } from '@/domain/milestones';
import { RATING_COLOR } from '@/components/ratings';
import type { ReplayData } from './replayData';

const W = 1080;
const H = 1920;
const FPS = 30;
const SLIDE = 3.2;

export function videoSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function' && !!pickMime();
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}

export async function renderReplayVideo(data: ReplayData, photos: { before?: string; after?: string }, onProgress: (p: number) => void): Promise<Blob> {
  const mime = pickMime();
  if (!mime) throw new Error('Video recording is not supported in this browser.');
  await Promise.all([document.fonts.load('700 120px "Unbounded Variable"'), document.fonts.load('600 40px "Manrope Variable"'), document.fonts.load('500 30px "JetBrains Mono Variable"')]).catch(() => undefined);
  const imgs = {
    before: photos.before ? await loadImage(photos.before) : undefined,
    after: photos.after ? await loadImage(photos.after) : undefined,
  };

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  // CanvasRenderingContext2D.roundRect is missing on older Safari versions.
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  };
  const display = '"Unbounded Variable", sans-serif';
  const body = '"Manrope Variable", sans-serif';
  const mono = '"JetBrains Mono Variable", monospace';

  const bg = () => {
    const grd = g.createRadialGradient(W / 2, H * 0.38, 50, W / 2, H * 0.4, H * 0.8);
    grd.addColorStop(0, '#11281a');
    grd.addColorStop(1, '#030504');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(160,245,184,0.04)';
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H * 0.45);
      g.stroke();
    }
  };
  const text = (s: string, y: number, font: string, color: string, alpha = 1, spacing = 0) => {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.font = font;
    g.textAlign = 'center';
    if (spacing && 'letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
    g.fillText(s, W / 2, y);
    g.restore();
  };
  const ring = (cx: number, cy: number, r: number, pct: number, alpha: number) => {
    g.save();
    g.globalAlpha = alpha;
    g.lineWidth = 14;
    g.strokeStyle = 'rgba(160,245,184,0.12)';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#a0f5b8';
    g.shadowColor = 'rgba(55,217,120,0.8)';
    g.shadowBlur = 30;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    g.stroke();
    g.restore();
  };

  type Draw = (t: number) => void;
  const slides: Draw[] = [
    (t) => {
      ring(W / 2, 700, 230, ease(t * 1.4) * 0.83, ease(t * 3));
      text('TRANSFORMATION REPLAY', 1120, `500 34px ${mono}`, '#a0f5b8', ease(t * 3), 10);
      text(data.lockIn.name.toUpperCase(), 1240, `700 64px ${display}`, '#f5fff7', ease(t * 2 - 0.3));
      text(formatRange(data.lockIn.startDate, data.lockIn.targetDate), 1320, `600 38px ${body}`, '#98ad9f', ease(t * 2 - 0.6));
    },
    (t) => {
      text('THE MISSION', 640, `500 34px ${mono}`, '#a0f5b8', ease(t * 3), 10);
      data.goals.forEach((goal, i) => text(goal, 780 + i * 90, `600 56px ${body}`, '#f5fff7', ease(t * 3 - 0.3 - i * 0.25)));
      if (data.lockIn.motivation) text(`“${data.lockIn.motivation.slice(0, 48)}${data.lockIn.motivation.length > 48 ? '…' : ''}”`, 780 + data.goals.length * 90 + 80, `italic 500 36px ${body}`, '#98ad9f', ease(t * 2 - 1));
    },
    (t) => {
      text(String(Math.round(data.elapsedDays * ease(t * 1.5))), 960, `700 300px ${display}`, '#f5fff7', ease(t * 3));
      text('DAYS LOCKED IN', 1060, `500 36px ${mono}`, '#a0f5b8', ease(t * 3 - 0.3), 10);
      text(`${data.checkIns} check-ins recorded`, 1160, `600 42px ${body}`, '#98ad9f', ease(t * 2 - 0.8));
    },
    (t) => {
      const cols = data.totalDays > 120 ? 20 : data.totalDays > 60 ? 12 : 10;
      const size = Math.floor(800 / cols);
      const rows = Math.ceil(data.totalDays / cols);
      const top = 960 - (rows * size) / 2;
      const shown = Math.floor(data.mosaic.length * ease(t * 1.3));
      data.mosaic.forEach((m, i) => {
        if (i >= shown) return;
        const x = W / 2 - (cols * size) / 2 + (i % cols) * size;
        const y = top + Math.floor(i / cols) * size;
        g.fillStyle = m && m !== 'logged' ? RATING_COLOR[m] : m === 'logged' ? 'rgba(160,245,184,0.45)' : '#1d2721';
        rr(x + 3, y + 3, size - 6, size - 6, 8);
        g.fill();
      });
      text('EVERY DAY, YOUR COLOUR', top - 70, `500 34px ${mono}`, '#a0f5b8', ease(t * 3), 8);
    },
    (t) => {
      text(String(Math.round(data.sessions * ease(t * 1.5))), 900, `700 260px ${display}`, '#f5fff7', ease(t * 3));
      text('WORKOUTS RECORDED', 1000, `500 36px ${mono}`, '#a0f5b8', ease(t * 3 - 0.3), 10);
      text(`${data.sets} logged sets · ${data.restDays} planned rest days`, 1100, `600 40px ${body}`, '#98ad9f', ease(t * 2 - 0.8));
    },
    (t) => {
      text(data.sleepAvg === null ? '—' : `${(data.sleepAvg * ease(t * 1.5)).toFixed(1)}h`, 900, `700 220px ${display}`, '#f5fff7', ease(t * 3));
      text('AVERAGE SLEEP', 1000, `500 36px ${mono}`, '#a0f5b8', ease(t * 3 - 0.3), 10);
      text(`${data.sleepNights} nights recorded`, 1100, `600 40px ${body}`, '#98ad9f', ease(t * 2 - 0.8));
    },
    (t) => {
      text('MILESTONES', 560, `500 34px ${mono}`, '#a0f5b8', ease(t * 3), 10);
      data.milestones.slice(0, 8).forEach((m, i) => text(MILESTONE_BY_KEY[m.key]?.title ?? m.key, 680 + i * 86, `600 48px ${body}`, '#f5fff7', ease(t * 3 - 0.2 - i * 0.18)));
      if (!data.milestones.length) text('Every day still counted.', 900, `600 48px ${body}`, '#98ad9f', ease(t * 2));
    },
  ];
  if (imgs.before && imgs.after) {
    slides.push((t) => {
      const w = 470;
      const h = 627;
      [imgs.before!, imgs.after!].forEach((im, i) => {
        const x = W / 2 - w - 15 + i * (w + 30);
        const y = 620;
        g.save();
        g.globalAlpha = ease(t * 2.5 - i * 0.4);
        rr(x, y, w, h, 28);
        g.clip();
        const s = Math.max(w / im.width, h / im.height);
        g.drawImage(im, x + (w - im.width * s) / 2, y + (h - im.height * s) / 2, im.width * s, im.height * s);
        g.restore();
      });
      text('BEFORE · AFTER', 540, `500 34px ${mono}`, '#a0f5b8', ease(t * 3), 10);
    });
  }
  slides.push((t) => {
    ring(W / 2, 760, 200, ease(t * 1.5), ease(t * 3));
    text('LOCK IN', 1110, `500 40px ${mono}`, '#a0f5b8', ease(t * 3 - 0.3), 14);
    text(data.lockIn.status === 'completed' ? 'COMPLETE' : `DAY ${data.elapsedDays}`, 1230, `700 110px ${display}`, '#f5fff7', ease(t * 2 - 0.5));
    text(data.lockIn.name, 1330, `600 40px ${body}`, '#98ad9f', ease(t * 2 - 0.9));
    text(`TGLI · ${formatDate(data.lockIn.targetDate)}`, 1780, `500 26px ${mono}`, '#63766a', ease(t * 2 - 1));
  });

  const stream = canvas.captureStream(FPS);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((res) => (rec.onstop = () => res(new Blob(chunks, { type: mime.split(';')[0] }))));
  const total = slides.length * SLIDE;
  rec.start(500);
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const frame = () => {
      const el = (performance.now() - start) / 1000;
      if (el >= total) {
        resolve();
        return;
      }
      const i = Math.min(slides.length - 1, Math.floor(el / SLIDE));
      const t = (el - i * SLIDE) / SLIDE;
      bg();
      g.save();
      g.globalAlpha = t > 0.9 && i < slides.length - 1 ? 1 - (t - 0.9) * 10 : 1;
      slides[i](t);
      g.restore();
      onProgress(el / total);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  rec.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  return done;
}
