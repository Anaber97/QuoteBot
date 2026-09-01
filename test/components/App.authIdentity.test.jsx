import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

/**
 * AUTH IDENTITY CHANGE + FAILED PROFILE/CONFIG LOAD TESTS
 *
 * App.jsx previously left a stale `profile` (from a *different* signed-in
 * user) in place whenever the profile fetch for the *current* session
 * failed, and gave no visible feedback that anything had gone wrong. This
 * exercises: successful load, a failed profile load, and switching identity
 * mid-session (sign out -> sign in as someone else).
 */

let authStateCallback = null;
let currentSession = null;
const profilesById = {
  'user-1': { id: 'user-1', company_id: 'company-a', role: 'manager', email: 'm@example.com', full_name: 'Manager One' },
  'user-2': { id: 'user-2', company_id: 'company-a', role: 'dispatch', email: 'd@example.com', full_name: 'Dispatcher Two' },
};
const failProfileFor = new Set();

function makeThenableBuilder(resolveValue) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: () => Promise.resolve(resolveValue()),
    single: () => Promise.resolve(resolveValue()),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveValue()).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: currentSession } })),
      onAuthStateChange: vi.fn((callback) => {
        authStateCallback = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      }),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col, id) => ({
              single: async () => {
                if (failProfileFor.has(id)) return { data: null, error: { message: 'profile lookup failed' } };
                return { data: profilesById[id] || null, error: null };
              },
            }),
          }),
        };
      }
      if (table === 'app_config') {
        return makeThenableBuilder(() => ({ data: null, error: null }));
      }
      if (table === 'clients') {
        return makeThenableBuilder(() => ({ data: [], error: null }));
      }
      return makeThenableBuilder(() => ({ data: null, error: null }));
    }),
  },
}));

vi.mock('../../src/lib/api.js', () => ({
  // Force the getAppConfig fetch path to fail so App falls back to the
  // direct Supabase app_config query above (keeps this test focused).
  authenticatedFetch: vi.fn(async () => { throw new Error('network unavailable'); }),
}));

const { default: App } = await import('../../src/App.jsx');

function signIn(userId) {
  currentSession = { user: { id: userId } };
  return act(async () => {
    authStateCallback('SIGNED_IN', currentSession);
  });
}

function signOut() {
  currentSession = null;
  return act(async () => {
    authStateCallback('SIGNED_OUT', null);
  });
}

describe('App auth identity + profile load handling', () => {
  beforeEach(() => {
    authStateCallback = null;
    currentSession = null;
    failProfileFor.clear();
  });

  test('shows the login card when there is no session', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('successfully loads a profile after sign-in and shows no error banner', async () => {
    render(<App />);
    await waitFor(() => expect(authStateCallback).toBeTruthy());
    await signIn('user-1');
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  test('a failed profile load surfaces a visible error and does not crash', async () => {
    failProfileFor.add('user-1');
    render(<App />);
    await waitFor(() => expect(authStateCallback).toBeTruthy());
    await signIn('user-1');
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your account profile/i);
  });

  test('switching identity from a failed user to a valid user clears the error banner', async () => {
    failProfileFor.add('user-1');
    render(<App />);
    await waitFor(() => expect(authStateCallback).toBeTruthy());
    await signIn('user-1');
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await signOut();
    await signIn('user-2');
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  test('signing out after a successful session returns to the login card', async () => {
    render(<App />);
    await waitFor(() => expect(authStateCallback).toBeTruthy());
    await signIn('user-1');
    await signOut();
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
