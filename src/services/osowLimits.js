import { authenticatedFetch } from '../lib/api';

export async function loadOsowLimits() {
  const response = await authenticatedFetch('/api/ops?check=osow-limits');
  const payload = await response.json();
  if (!response.ok || !Array.isArray(payload.limits)) throw new Error(payload.error || 'Unable to load OSOW limits.');
  return payload.limits;
}
