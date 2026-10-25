import { AnimatePresence, motion } from 'motion/react';
import { TriangleAlert, CircleCheck, Info } from 'lucide-react';
import { create } from 'zustand';
import { createPortal } from 'react-dom';
import { useUI } from '@/state/ui';
import { Button } from './primitives';

/* ── Confirm dialog (promise based) ──────────────────────── */

interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'default';
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<{ req: ConfirmRequest | null; set: (r: ConfirmRequest | null) => void }>((set) => ({
  req: null,
  set: (req) => set({ req }),
}));

export function confirmAction(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const req = useConfirmStore((s) => s.req);
  const set = useConfirmStore((s) => s.set);
  const close = (ok: boolean) => {
    req?.resolve(ok);
    set(null);
  };
  return createPortal(
    <AnimatePresence>
      {req && (
        <>
          <motion.div className="sheet-backdrop" style={{ zIndex: 94 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close(false)} />
          <motion.div
            className="confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ opacity: 0, scale: 0.92, x: '-50%', y: '-46%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-48%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 420 }}
          >
            <h2 id="confirm-title" className="t-h3">
              {req.title}
            </h2>
            {req.message && (
              <p className="t-small" style={{ marginTop: 8 }}>
                {req.message}
              </p>
            )}
            <div className="confirm__actions">
              <Button variant="secondary" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button variant={req.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                {req.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── Toast ───────────────────────────────────────────────── */

export function ToastHost() {
  const toast = useUI((s) => s.toast);
  const dismiss = useUI((s) => s.dismissToast);
  return createPortal(
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className={`toast toast--${toast.tone}`}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -24, x: '-50%', scale: 0.96 }}
          animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
          exit={{ opacity: 0, y: -16, x: '-50%', scale: 0.98 }}
          transition={{ type: 'spring', damping: 26, stiffness: 380 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(_, i) => i.offset.y < -20 && dismiss()}
        >
          <span className="toast__icon">{toast.tone === 'error' ? <TriangleAlert /> : toast.tone === 'success' ? <CircleCheck /> : <Info />}</span>
          <span className="grow">{toast.text}</span>
          {toast.action && (
            <button
              className="toast__action"
              onClick={() => {
                toast.action?.run();
                dismiss();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
