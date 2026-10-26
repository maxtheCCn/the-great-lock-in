import { isIOS, isStandalone } from './platform';

/**
 * Works around an iOS bug in Home Screen web apps (WebKit bug 301994, still
 * present on iOS 26.5 and the iOS 27 betas): the web view comes up about one
 * status-bar height short, either after the software keyboard has been open or
 * straight from launch. iOS paints the strip below it itself, in the cached page
 * background colour, so the app looks cut off above a dark band.
 *
 * 1. Heal: briefly collapsing the whole document changes the web view's content
 *    size, which makes WebKit re-measure the viewport. This fixes the keyboard
 *    variant.
 * 2. Compensate: if the gap survives, publish it as --vp-gap (and
 *    data-vp-gap on <html>). CSS then stops reserving home-indicator space the
 *    band already covers and fades the bottom edge into the page background, so
 *    the band reads as margin instead of a cut.
 */
const SCROLLERS = '.page, .sheet__body, .chat__scroll, .ob__step, .rp-setup';
/** Larger differences are the keyboard or a split view, not this bug. */
const MAX_GAP = 120;

let gap = 0;

/** The current uncovered strip in CSS px, 0 when the viewport is whole. */
export function viewportGap(): number {
  return gap;
}

function expectedHeight(): number {
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  return portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
}

function editing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function measuredGap(): number {
  const g = Math.round(expectedHeight() - window.innerHeight);
  return g > 4 && g <= MAX_GAP ? g : 0;
}

function publishGap() {
  // While the keyboard is up the viewport is meant to be short.
  if (editing()) return;
  const next = measuredGap();
  if (next === gap) return;
  gap = next;
  const root = document.documentElement;
  root.style.setProperty('--vp-gap', `${gap}px`);
  if (gap) root.dataset.vpGap = String(gap);
  else delete root.dataset.vpGap;
}

function heal() {
  if (editing()) return;
  if (measuredGap()) {
    const html = document.documentElement;
    const scrollers = [...document.querySelectorAll<HTMLElement>(SCROLLERS)].map((el) => [el, el.scrollTop] as const);
    html.style.display = 'none';
    void html.offsetHeight; // synchronous reflow, nothing is painted in between
    html.style.display = '';
    for (const [el, top] of scrollers) el.scrollTop = top;
    window.scrollTo(0, 0);
  }
  requestAnimationFrame(publishGap);
  setTimeout(publishGap, 400);
}

export function installViewportHeal() {
  if (!isIOS() || !isStandalone()) return;
  window.addEventListener('resize', publishGap);
  window.addEventListener('orientationchange', () => setTimeout(heal, 400));
  window.addEventListener('pageshow', () => setTimeout(heal, 300));
  document.addEventListener('focusout', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      setTimeout(heal, 140);
      setTimeout(heal, 700);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(heal, 300);
  });
  publishGap();
  setTimeout(heal, 600);
  setTimeout(heal, 2000);
}
