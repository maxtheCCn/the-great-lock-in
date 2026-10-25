/**
 * Works around an iOS bug in Home Screen web apps: after the software keyboard
 * has been open, the viewport (innerHeight, 100dvh, fixed elements) stays about
 * one status-bar height too short until the app is force-quit. The result is a
 * black band at the bottom and a tab bar that sits too high.
 *
 * Briefly hiding and re-showing a full-height element makes WebKit re-measure
 * the viewport. We only do it when the height is actually stuck.
 * Background: https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d
 */
import { isIOS, isStandalone } from './platform';

const SCROLLERS = '.page, .sheet__body, .chat__scroll, .ob__step, .rp-setup';

/** In standalone mode with a translucent status bar the app should fill the whole screen. */
function expectedHeight(): number {
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  return portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
}

export function installViewportHeal() {
  if (!isIOS() || !isStandalone()) return;

  let maxHeight = Math.max(window.innerHeight, expectedHeight());
  window.addEventListener('resize', () => {
    maxHeight = Math.max(maxHeight, window.innerHeight);
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      maxHeight = Math.max(window.innerHeight, expectedHeight());
    }, 400);
  });

  const heal = () => {
    if (maxHeight - window.innerHeight <= 4) return;
    const root = document.getElementById('root');
    if (!root) return;
    const scrollers = [...document.querySelectorAll<HTMLElement>(SCROLLERS)].map((el) => [el, el.scrollTop] as const);
    root.style.display = 'none';
    void root.offsetHeight; // synchronous reflow, no paint in between
    root.style.display = '';
    for (const [el, top] of scrollers) el.scrollTop = top;
    window.scrollTo(0, 0);
  };

  document.addEventListener('focusout', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) setTimeout(heal, 140);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(heal, 300);
  });
  setTimeout(heal, 600);
}
