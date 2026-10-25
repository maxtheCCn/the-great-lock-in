/**
 * API key storage. The key never leaves this device except in requests sent
 * directly to the chosen provider. It is excluded from backups and never logged.
 *
 * - "device": kept in this browser's IndexedDB until you remove it.
 * - "session": kept only in memory / sessionStorage and forgotten when the app closes.
 */
import { db } from '@/data/db';
import type { CoachSettings } from '@/data/types';

const ROW = 'coach.key';
const SESSION = 'tgli.coachKey';
let memoryKey: string | null = null;

export async function getApiKey(storage: CoachSettings['keyStorage']): Promise<string | null> {
  if (storage === 'session') {
    if (memoryKey) return memoryKey;
    try {
      memoryKey = sessionStorage.getItem(SESSION);
    } catch {
      /* blocked */
    }
    return memoryKey;
  }
  const row = await db.settings.get(ROW);
  return typeof row?.value === 'string' ? row.value : null;
}

export async function setApiKey(key: string, storage: CoachSettings['keyStorage']): Promise<void> {
  await clearApiKey();
  if (storage === 'session') {
    memoryKey = key;
    try {
      sessionStorage.setItem(SESSION, key);
    } catch {
      /* memory only */
    }
  } else {
    await db.settings.put({ key: ROW, value: key });
  }
}

export async function clearApiKey(): Promise<void> {
  memoryKey = null;
  try {
    sessionStorage.removeItem(SESSION);
  } catch {
    /* ignore */
  }
  await db.settings.delete(ROW);
}

export const maskKey = (k: string) => (k.length <= 10 ? '••••' : `${k.slice(0, 6)}…${k.slice(-4)}`);
