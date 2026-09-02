import { supabase } from './supabase';

export async function authenticatedFetch(input, init = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error('Unable to verify your session. Please try again.');
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');

  const request = (accessToken) => {
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(input, { ...init, headers });
  };

  const response = await request(session.access_token);
  if (response.status !== 401) return response;

  // A tab can remain open across an access-token rotation. Refresh once and
  // retry the exact request so settings saves do not strand valid sessions.
  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
  const refreshedToken = refreshedData?.session?.access_token;
  if (refreshError || !refreshedToken) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return request(refreshedToken);
}
