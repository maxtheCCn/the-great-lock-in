import { create } from 'zustand';

/**
 * App update state, shared by the update banner and the Profile screen.
 * The service worker is registered in App via `useRegisterSW`, which fills this store.
 */
interface UpdateState {
  needRefresh: boolean;
  checking: boolean;
  dismissed: boolean;
  registration: ServiceWorkerRegistration | null;
  apply: () => void;
}

export const useUpdates = create<UpdateState>(() => ({
  needRefresh: false,
  checking: false,
  dismissed: false,
  registration: null,
  apply: () => location.reload(),
}));

/** Asks the server for a newer version. Home Screen apps are rarely reloaded, so we also do this on every return to the app. */
export async function checkForUpdate(): Promise<'available' | 'latest' | 'unavailable'> {
  const { registration } = useUpdates.getState();
  if (!registration) return 'unavailable';
  useUpdates.setState({ checking: true });
  try {
    await registration.update();
    // Give a freshly found worker a moment to finish installing.
    for (let i = 0; i < 10 && registration.installing; i++) await new Promise((r) => setTimeout(r, 300));
    const available = useUpdates.getState().needRefresh || !!registration.waiting;
    if (available) useUpdates.setState({ needRefresh: true, dismissed: false });
    return available ? 'available' : 'latest';
  } catch {
    return 'unavailable';
  } finally {
    useUpdates.setState({ checking: false });
  }
}

export const BUILD_TIME = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : new Date().toISOString();

export function formatBuild(iso = BUILD_TIME): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
