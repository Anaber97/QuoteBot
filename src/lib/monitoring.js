const redact = (value) => String(value || 'Unknown error')
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
  .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]')
  .slice(0, 300);

export function reportFrontendError(error, context = {}) {
  const event = {
    level: 'error',
    event: 'frontend_exception',
    message: redact(error instanceof Error ? error.message : error),
    component: String(context.component || 'unknown').slice(0, 80),
  };
  console.error(JSON.stringify(event));
}

export function installGlobalErrorReporting() {
  window.addEventListener('error', (event) => reportFrontendError(event.error || event.message, { component: 'window' }));
  window.addEventListener('unhandledrejection', (event) => reportFrontendError(event.reason, { component: 'promise' }));
}

