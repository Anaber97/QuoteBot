import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useWorkspaceSession } from '../../src/features/auth/useWorkspaceSession';

const mocks = vi.hoisted(() => ({ callback: null, profile: vi.fn(), fetch: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: (callback) => {
      mocks.callback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    },
  },
  from: (table) => ({ select: () => ({ eq: () => table === 'profiles'
    ? { single: mocks.profile }
    : Promise.resolve({ data: [], error: null }) }) }),
} }));
vi.mock('../../src/lib/api', () => ({ authenticatedFetch: (...args) => mocks.fetch(...args) }));

const session = { user: { id: 'user-a' } };
const profile = { id: 'user-a', company_id: 'company-a', role: 'manager' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile.mockResolvedValue({ data: profile, error: null });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ config: { company_id: 'company-a' } }) });
});

test('refreshing an access token does not reload the workspace or reset unsaved inputs', async () => {
  const reset = vi.fn();
  const { result } = renderHook(() => useWorkspaceSession(reset));
  await act(async () => mocks.callback('SIGNED_IN', session));
  await waitFor(() => expect(result.current.profile).toEqual(profile));
  const resets = reset.mock.calls.length;
  await act(async () => mocks.callback('TOKEN_REFRESHED', { ...session, access_token: 'refreshed' }));
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(reset).toHaveBeenCalledTimes(resets);
  expect(result.current.session.access_token).toBe('refreshed');
});

test('a late workspace response cannot restore data after sign-out', async () => {
  let resolveProfile;
  mocks.profile.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
  const { result } = renderHook(() => useWorkspaceSession(vi.fn()));
  await act(async () => mocks.callback('SIGNED_IN', session));
  await waitFor(() => expect(mocks.profile).toHaveBeenCalled());
  await act(async () => mocks.callback('SIGNED_OUT', null));
  await act(async () => resolveProfile({ data: profile, error: null }));
  expect(result.current.session).toBeNull();
  expect(result.current.profile).toBeNull();
  expect(result.current.companyRates.company_id).not.toBe('company-a');
});
