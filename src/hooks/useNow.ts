import { useEffect, useState } from 'react';
import { toISO } from '@/domain/dates';

/** Current time, re-rendering every `intervalMs` while the page is visible. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      setNow(new Date());
      id = setInterval(() => setNow(new Date()), intervalMs);
    };
    const stop = () => clearInterval(id);
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs]);
  return now;
}

/** Today's local date; updates after midnight and when the app returns to the foreground. */
export function useToday(): string {
  const now = useNow(30_000);
  return toISO(now);
}
