import { createContext, useContext } from 'react';
import type { LockIn } from '@/data/types';

/** The active Lock In. The main shell only renders when one exists. */
export const LockInContext = createContext<LockIn | null>(null);

export function useActive(): LockIn {
  const l = useContext(LockInContext);
  if (!l) throw new Error('useActive() used outside an active Lock In');
  return l;
}
