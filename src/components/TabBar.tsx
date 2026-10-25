import { motion } from 'motion/react';
import { TABS, useNav, type Tab } from '@/nav/store';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const ACCENT = '#a0f5b8';

function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const a = active ? ACCENT : 'currentColor';
  switch (tab) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.5" {...S} opacity={0.35} />
          <path d="M12 3.5a8.5 8.5 0 1 1-7.36 4.25" {...S} stroke={a} strokeWidth={2} />
          <circle cx="12" cy="12" r={active ? 2.6 : 2} fill={a} />
        </svg>
      );
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24">
          <rect x="4" y="4" width="7" height="7" rx="2.2" {...S} />
          <rect x="13" y="4" width="7" height="7" rx="2.2" {...S} fill={active ? ACCENT : 'none'} stroke={a} />
          <rect x="4" y="13" width="7" height="7" rx="2.2" {...S} />
          <rect x="13" y="13" width="7" height="7" rx="2.2" {...S} opacity={0.5} />
        </svg>
      );
    case 'progress':
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 20h16" {...S} opacity={0.45} />
          <path d="M6.5 16v-3M11 16V9.5M15.5 16v-5M20 16V5" {...S} />
          <path d="M5 11.5 10 7l4 3.5L20 4.5" {...S} stroke={a} strokeWidth={active ? 2.1 : 1.7} />
        </svg>
      );
    case 'coach':
      return (
        <svg viewBox="0 0 24 24">
          <path d="M20 12.5a7.5 7.5 0 0 1-11.1 6.6L4.5 20l1-3.9A7.5 7.5 0 1 1 20 12.5Z" {...S} />
          <path d="M12.5 8.2l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4Z" fill={a} stroke={a} strokeWidth={0.8} strokeLinejoin="round" />
        </svg>
      );
    case 'profile':
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="9" r="3.6" {...S} stroke={a} fill={active ? 'rgba(160,245,184,0.25)' : 'none'} />
          <path d="M5.5 19.5c1.2-3.2 3.7-4.8 6.5-4.8s5.3 1.6 6.5 4.8" {...S} />
        </svg>
      );
  }
}

const LABELS: Record<Tab, string> = { home: 'Home', calendar: 'Calendar', progress: 'Progress', coach: 'Coach', profile: 'Profile' };

export function TabBar({ badges }: { badges?: Partial<Record<Tab, boolean>> }) {
  const tab = useNav((s) => s.tab);
  const setTab = useNav((s) => s.setTab);
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const active = t === tab;
        return (
          <motion.button
            key={t}
            type="button"
            className="tabbar__item"
            aria-current={active ? 'page' : undefined}
            onClick={() => setTab(t)}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 600, damping: 30 }}
          >
            {active && (
              <motion.span layoutId="tab-glow" className="tabbar__glow" transition={{ type: 'spring', stiffness: 480, damping: 36 }}>
                <span className="tabbar__bar" />
              </motion.span>
            )}
            <span className="tabbar__icon">
              <TabIcon tab={t} active={active} />
              {badges?.[t] && <span className="tabbar__badge" />}
            </span>
            <span className="tabbar__label">{LABELS[t]}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
