/**
 * Daily check-in reminder.
 *
 * Honest constraints:
 * - Browsers cannot schedule local notifications for a fully closed web app.
 *   Reliable closed-app delivery needs Web Push from a server, which TGLI does not run yet.
 * - On iPhone, web notifications only exist for apps added to the Home Screen (iOS 16.4+).
 *
 * What TGLI does: while the app is open (or briefly backgrounded), it shows a
 * notification at the chosen time if today's check-in is still missing, and
 * always shows an in-app reminder on Home after that time.
 */
import { isIOS, isStandalone } from './platform';

export type NotificationSupport = 'unsupported' | 'needs-install' | 'default' | 'granted' | 'denied';

export function notificationSupport(): NotificationSupport {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  return Notification.permission as NotificationSupport;
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (!('Notification' in window)) return notificationSupport();
  try {
    const result = await Notification.requestPermission();
    return result as NotificationSupport;
  } catch {
    return notificationSupport();
  }
}

const REMINDED_KEY = 'tgli.remindedOn';

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function isPastReminderTime(time: string, now = new Date()): boolean {
  return now.getHours() * 60 + now.getMinutes() >= minutesOf(time);
}

async function showReminder() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const title = 'Time to check in';
  const options: NotificationOptions = {
    body: 'Thirty seconds to log today. Your Lock In is waiting.',
    icon: `${import.meta.env.BASE_URL}pwa-192x192.png`,
    badge: `${import.meta.env.BASE_URL}pwa-64x64.png`,
    tag: 'tgli-daily-checkin',
  };
  if (reg) await reg.showNotification(title, options);
  else new Notification(title, options);
}

export interface ReminderState {
  enabled: boolean;
  time: string;
  checkedInToday: boolean;
  today: string;
}

/** Checks every 30 s while the app runs. Returns a stop function. */
export function startReminderLoop(getState: () => Promise<ReminderState | null>): () => void {
  let stopped = false;
  const check = async () => {
    if (stopped) return;
    try {
      const s = await getState();
      if (!s || !s.enabled || s.checkedInToday) return;
      if (notificationSupport() !== 'granted') return;
      if (!isPastReminderTime(s.time)) return;
      if (localStorage.getItem(REMINDED_KEY) === s.today) return;
      localStorage.setItem(REMINDED_KEY, s.today);
      await showReminder();
    } catch (e) {
      console.warn('reminder check failed', e);
    }
  };
  const id = setInterval(check, 30_000);
  check();
  return () => {
    stopped = true;
    clearInterval(id);
  };
}
