import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from './_env.js';

const rateBuckets = new Map();

export function createAdminClient() {
  const supabaseUrl = getServerEnv('SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY') || getServerEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

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

export function enforceRateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (bucket.count >= limit) {
    const error = new Error('Too many requests. Please try again later.');
    error.status = 429;
    error.retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw error;
  }
  bucket.count += 1;
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
