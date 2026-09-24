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
const isStaleChunkError = (reason) => /failed to fetch dynamically imported module|importing a module script failed/i.test(String(reason?.message || reason || ''));
const recoverFromStaleChunk = async () => {
  if (sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)) return;
  sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, '1');
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheNames = await caches?.keys?.() || [];
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  } catch { /* Reload still fetches the current deployment without this cleanup. */ }
  window.location.reload();
};

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
