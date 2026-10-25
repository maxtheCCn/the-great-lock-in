import { create } from 'zustand';
import type { ISODate, WorkoutExercise } from '@/data/types';

export type SheetSpec =
  | { type: 'checkin'; date: ISODate }
  | { type: 'workout'; id?: string; date?: ISODate; prefill?: { title: string; exercises: WorkoutExercise[] } }
  | { type: 'measurement'; id?: string; kind?: string }
  | { type: 'photos'; date?: ISODate }
  | { type: 'goal'; id?: string }
  | { type: 'dashboard' };

export interface Toast {
  id: number;
  text: string;
  tone: 'default' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

interface UIState {
  sheet: SheetSpec | null;
  celebrations: string[];
  toast: Toast | null;
  openSheet: (s: SheetSpec) => void;
  closeSheet: () => void;
  enqueueCelebrations: (keys: string[]) => void;
  shiftCelebration: () => void;
  showToast: (text: string, opts?: Partial<Omit<Toast, 'id' | 'text'>>) => void;
  dismissToast: () => void;
}

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUI = create<UIState>((set) => ({
  sheet: null,
  celebrations: [],
  toast: null,
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  enqueueCelebrations: (keys) => set((s) => ({ celebrations: [...s.celebrations, ...keys.filter((k) => !s.celebrations.includes(k))] })),
  shiftCelebration: () => set((s) => ({ celebrations: s.celebrations.slice(1) })),
  showToast: (text, opts) => {
    clearTimeout(toastTimer);
    const toast: Toast = { id: ++toastSeq, text, tone: opts?.tone ?? 'default', action: opts?.action };
    set({ toast });
    toastTimer = setTimeout(() => set((s) => (s.toast?.id === toast.id ? { toast: null } : s)), opts?.action ? 5000 : 2800);
  },
  dismissToast: () => set({ toast: null }),
}));

export const toast = (text: string, opts?: Partial<Omit<Toast, 'id' | 'text'>>) => useUI.getState().showToast(text, opts);
