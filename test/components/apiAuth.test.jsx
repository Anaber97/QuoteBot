import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, refreshSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getSession, refreshSession } },
}));

import { authenticatedFetch } from '../../src/lib/api';

describe('authenticatedFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSession.mockReset();
    refreshSession.mockReset();
  });

  it('adds the current access token to protected requests', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'current-token' } }, error: null });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await authenticatedFetch('/api/saveAppConfig', { method: 'POST', body: '{}' });
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer current-token');
  });

  it('refreshes and retries once after an authentication response', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'stale-token' } }, error: null });
    refreshSession.mockResolvedValue({ data: { session: { access_token: 'fresh-token' } }, error: null });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"error":"Authentication required."}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const response = await authenticatedFetch('/api/saveAppConfig', { method: 'POST', body: '{}' });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer fresh-token');
  });
});
