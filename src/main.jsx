import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './index.css';
import { installGlobalErrorReporting } from './lib/monitoring.js';

installGlobalErrorReporting();

// Vercel deploys replace hashed chunks. If an already-open PWA requests a
// chunk from the previous build, recover once into the current app instead of
// leaving the customer on a blank error screen.
const STALE_CHUNK_RELOAD_KEY = 'towcalc:stale-chunk-reload';
// Long enough to stop a reload loop if a chunk is truly missing, short enough
// that a tab left open across several deploys still recovers each time.
const STALE_CHUNK_RELOAD_COOLDOWN_MS = 60_000;
const isStaleChunkError = (reason) => /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(String(reason?.message || reason || ''));
const recoverFromStaleChunk = async () => {
  try {
    const lastReload = Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - lastReload < STALE_CHUNK_RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now()));
  } catch { return; /* Without a loop guard, never auto-reload. */ }
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheNames = await caches?.keys?.() || [];
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  } catch { /* Reload still fetches the current deployment without this cleanup. */ }
  window.location.reload();
};

// Vite fires this for every failed lazy chunk, including ones whose callers
// catch the error themselves (e.g. the calculator's routeStates import), so
// recovery doesn't depend on the rejection going unhandled.
window.addEventListener('vite:preloadError', (event) => {
  // @ts-ignore Vite attaches the original error as `payload`.
  if (isStaleChunkError(event.payload)) void recoverFromStaleChunk();
});
window.addEventListener('unhandledrejection', (event) => {
  if (!isStaleChunkError(event.reason)) return;
  event.preventDefault();
  void recoverFromStaleChunk();
});
window.addEventListener('error', (event) => {
  if (isStaleChunkError(event.error || event.message)) void recoverFromStaleChunk();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
