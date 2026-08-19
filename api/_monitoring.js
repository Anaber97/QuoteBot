import { getServerEnv } from './_env.js';

const safeMessage = (error) => String(error instanceof Error ? error.message : error || 'Unknown error')
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
  .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]')
  .replace(/\b\d{1,6}\s+[A-Za-z0-9.' -]+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi, '[address]')
  .slice(0, 500);

export function operationalEvent(level, event, context = {}) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...Object.fromEntries(Object.entries(context).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))),
  };
  const writer = level === 'error' ? console.error : console.info;
  writer(JSON.stringify(payload));
  return payload;
}

export async function reportOperationalError(error, context = {}) {
  const payload = operationalEvent('error', context.event || 'api_failure', {
    route: context.route || 'unknown',
    provider: context.provider || 'application',
    error: safeMessage(error),
  });
  const webhook = getServerEnv('ERROR_WEBHOOK_URL');
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    operationalEvent('error', 'monitor_delivery_failed', { provider: 'monitoring' });
  }
}

