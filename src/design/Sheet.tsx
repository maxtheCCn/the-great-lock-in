import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton, cx } from './primitives';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: ReactNode;
  headerRight?: ReactNode;
  footer?: ReactNode;
  full?: boolean;
  children: ReactNode;
  /** Prevent swipe/backdrop dismissal, e.g. while saving. */
  locked?: boolean;
}

export function Sheet({ open, onClose, title, eyebrow, headerRight, footer, full, children, locked }: SheetProps) {
  const controls = useDragControls();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.focus({ preventScroll: true }), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, locked, onClose]);

  const startDrag = (e: React.PointerEvent) => {
    if (!locked) controls.start(e);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => !locked && onClose()}
          />
          <motion.div
            key="sheet"
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            className={cx('sheet', full && 'sheet--full')}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 360, mass: 0.9 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 650) onClose();
            }}
            style={{ outline: 'none' }}
          >
            <div className="sheet__grab" onPointerDown={startDrag}>
              <span />
            </div>
            {(title || eyebrow || headerRight) && (
              <div className="sheet__header" onPointerDown={startDrag}>
                <div className="stack grow">
                  {eyebrow && <span className="t-eyebrow">{eyebrow}</span>}
                  {title && <h2 className="t-h2">{title}</h2>}
                </div>
                {headerRight}
                <IconButton label="Close" size="sm" onClick={onClose} disabled={locked}>
                  <X />
                </IconButton>
              </div>
            )}
            <div className="sheet__body">{children}</div>
            {footer && <div className="sheet__footer">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
