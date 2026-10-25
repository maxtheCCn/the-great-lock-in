import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
import './styles/tokens.css';
import './styles/base.css';
import './design/design.css';
import './components/shell.css';
import App from './App';
import { captureInstallPrompt } from './services/platform';
import { installViewportHeal } from './services/viewportHeal';
import { dataMode } from './data/db';

captureInstallPrompt();
installViewportHeal();

if (import.meta.env.DEV) {
  // Dev-only test hook for driving navigation from the browser console.
  import('./nav/store').then((m) => Object.assign(window, { __tgli: { nav: m.useNav, go: m.go } }));
}

async function boot() {
  if (dataMode === 'demo') {
    const { seedDemo } = await import('./data/demo');
    await seedDemo().catch((e) => console.error('Demo seed failed', e));
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
