import { AnimatePresence, animate, motion } from 'motion/react';
import { Suspense, useEffect, useRef } from 'react';
import { RouteContext } from '@/components/Page';
import { Skeleton } from '@/design/primitives';
import { TABS, useNav, type Route, type Tab } from './store';
import { RouteView } from './routes';

const variants = {
  enter: (d: number) => (d === 1 ? { x: '100%', opacity: 1 } : d === -1 ? { x: '-28%', opacity: 0.4 } : { opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => (d === 1 ? { x: '-28%', opacity: 0.3 } : d === -1 ? { x: '100%', opacity: 1 } : { opacity: 0 }),
};

function PageSkeleton() {
  return (
    <div className="page">
      <div className="stack gap-4" style={{ paddingTop: 40 }}>
        <Skeleton h={14} w={120} />
        <Skeleton h={34} w="70%" />
        <Skeleton h={180} r={22} />
        <Skeleton h={120} r={22} />
      </div>
    </div>
  );
}

function TabStack({ tab, stack, active }: { tab: Tab; stack: Route[]; active: boolean }) {
  const direction = useNav((s) => s.direction);
  const ref = useRef<HTMLDivElement>(null);
  const top = stack[stack.length - 1];
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current && ref.current && document.documentElement.dataset.effects !== 'minimal') {
      animate(ref.current, { opacity: [0, 1], y: [10, 0] }, { duration: 0.35, ease: [0.22, 1, 0.36, 1] });
    }
    wasActive.current = active;
  }, [active]);

  return (
    <div className="tab-layer" hidden={!active} ref={ref} data-tab={tab}>
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={top.key}
          className="route"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 380, damping: 40, mass: 0.9 }}
          style={{ boxShadow: stack.length > 1 ? '-20px 0 40px -20px rgba(0,0,0,0.8)' : undefined }}
        >
          <RouteContext.Provider value={{ route: top, depth: stack.length - 1 }}>
            <Suspense fallback={<PageSkeleton />}>
              <RouteView route={top} />
            </Suspense>
          </RouteContext.Provider>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function Navigator() {
  const tab = useNav((s) => s.tab);
  const stacks = useNav((s) => s.stacks);
  return (
    <>
      {TABS.map((t) => (
        <TabStack key={t} tab={t} stack={stacks[t]} active={t === tab} />
      ))}
    </>
  );
}
