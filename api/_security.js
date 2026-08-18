import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from './_env.js';

export function createAdminClient() {
  const supabaseUrl = getServerEnv('SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing server-side Supabase environment variables.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(token) {
  const supabaseUrl = getServerEnv('SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL');
  const anonKey = getServerEnv('SUPABASE_ANON_KEY') || getServerEnv('VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Missing public Supabase server configuration.');
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function requireAuth(req) {
  const authorization = String(req.headers?.authorization || '');
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    const error = new Error('Authentication required.');
    error.status = 401;
    throw error;
  }

  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    const error = new Error('Invalid or expired session.');
    error.status = 401;
    throw error;
  }

  return { admin, user: userData.user, token };
}

export async function requireUser(req, { companyId = null, manager = false } = {}) {
  const { admin, user, token } = await requireAuth(req);
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, company_id, client_id, email, full_name, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    const error = new Error('User profile not found.');
    error.status = 403;
    throw error;
  }
  if (companyId && profile.company_id !== companyId) {
    const error = new Error('You do not have access to this company.');
    error.status = 403;
    throw error;
  }
  if (manager && String(profile.role).toLowerCase() !== 'manager') {
    const error = new Error('Manager access required.');
    error.status = 403;
    throw error;
  }

  return { admin, user, profile, token };
}

export async function enforceRateLimit(admin, key, { limit, windowMs }) {
  const { data, error: rateError } = await admin.rpc('consume_api_rate_limit', {
    p_key: String(key),
    p_limit: Number(limit),
    p_window_seconds: Math.max(1, Math.ceil(Number(windowMs) / 1000)),
  });
  if (rateError) throw new Error('Rate limit service unavailable.');
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) {
    const error = new Error('Too many requests. Please try again later.');
    error.status = 429;
    error.retryAfter = Number(result?.retry_after) || 60;
    throw error;
  }
}

export function sendApiError(res, error, fallback = 'Internal server error.') {
  const status = Number(error?.status) || 500;
  if (error?.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
  if (status >= 500) console.error(fallback, error);
  return res.status(status).json({ error: status >= 500 ? fallback : error.message });
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function getTrustedSiteUrl(req) {
  const configured = getServerEnv('SITE_URL');
  if (configured) return configured.replace(/\/$/, '');
  const origin = String(req.headers?.origin || '');
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  throw new Error('SITE_URL must be configured on the server.');
}
