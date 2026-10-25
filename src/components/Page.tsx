import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import { goBack, type Route } from '@/nav/store';
import { enterChild, enterParent } from '@/design/visuals';

export const RouteContext = createContext<{ route: Route; depth: number }>({ route: { name: 'home', key: 0 }, depth: 0 });
export const useRoute = () => useContext(RouteContext);

const scrollPositions = new Map<number, number>();

interface PageProps {
  title: ReactNode;
  /** Small title shown in the compact top bar. Defaults to `title` when it is a string. */
  barTitle?: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  heroRight?: ReactNode;
  actions?: ReactNode;
  backLabel?: string;
  children: ReactNode;
  /** Render children without staggered entrance (for heavy pages). */
  plain?: boolean;
}

export function Page({ title, barTitle, eyebrow, subtitle, heroRight, actions, backLabel = 'Back', children, plain }: PageProps) {
  const { route, depth } = useRoute();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: ref });
  const barOpacity = useTransform(scrollY, [24, 72], [0, 1]);
  const sub = depth > 0;

  useLayoutEffect(() => {
    const y = scrollPositions.get(route.key);
    if (y && ref.current) ref.current.scrollTop = y;
  }, [route.key]);
  useMotionValueEvent(scrollY, 'change', (y) => scrollPositions.set(route.key, y));

  const small = barTitle ?? (typeof title === 'string' ? title : '');

  return (
    <div className="page-frame">
      {(sub || actions) && (
        <div className="page__topbar">
          <motion.div className="page__topbar-bg" style={{ opacity: barOpacity }} />
          {sub && (
            <motion.button type="button" className="page__back" onClick={goBack} whileTap={{ scale: 0.94 }} style={{ position: 'relative' }}>
              <ChevronLeft />
              {backLabel}
            </motion.button>
          )}
          <motion.div className="page__topbar-title" style={{ opacity: barOpacity }}>
            {small}
          </motion.div>
          {actions && (
            <div className="page__topbar-actions" style={{ position: 'relative' }}>
              {actions}
            </div>
          )}
        </div>
      )}
      <div className={`page ${sub || actions ? 'page--sub' : ''}`} ref={ref}>
      <motion.div variants={plain ? undefined : enterParent} initial={plain ? undefined : 'hidden'} animate={plain ? undefined : 'show'}>
        <motion.header className="page__hero" variants={plain ? undefined : enterChild}>
          <div className="stack" style={{ minWidth: 0 }}>
            {eyebrow && <span className="t-eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</span>}
            <h1 className="page__hero-title">{title}</h1>
            {subtitle && <p className="page__hero-sub">{subtitle}</p>}
          </div>
          {heroRight}
        </motion.header>
        <div className="page__content">{children}</div>
      </motion.div>
      </div>
    </div>
  );
}

/** Wrap blocks inside a Page so they join the staggered entrance. */
export function Block({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div variants={enterChild} className={className} style={style}>
      {children}
    </motion.div>
  );
}
