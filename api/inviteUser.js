import { enforceRateLimit, getTrustedSiteUrl, requireUser, sendApiError } from './_security.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || 'client').toLowerCase();
    const companyId = String(body.company_id || '').trim();
    const inviteName = String(body.name || '').trim().slice(0, 120);
    const clientId = role === 'client' && body.client_id ? String(body.client_id) : null;
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email address is required.' });
    if (!companyId || !['manager', 'dispatch', 'client'].includes(role)) return res.status(400).json({ error: 'A valid company and role are required.' });

    const { admin, profile } = await requireUser(req, { companyId, manager: true });
    enforceRateLimit(`invite:${profile.id}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (clientId) {
      const { data: client } = await admin.from('clients').select('id').eq('id', clientId).eq('company_id', companyId).maybeSingle();
      if (!client) return res.status(400).json({ error: 'The selected client account is invalid.' });
    }

    const inviteToken = crypto.randomUUID();
    const redirectUrl = `${getTrustedSiteUrl(req)}/?invite=${inviteToken}&role=${encodeURIComponent(role)}`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: redirectUrl });
    if (error) throw error;
    const { error: inviteDbError } = await admin.from('company_invites').insert([{
      token: inviteToken, email, company_id: companyId, role, full_name: inviteName,
      invited_by: profile.id, client_id: clientId, status: 'pending', created_at: new Date().toISOString(),
    }]);
    if (inviteDbError) {
      if (data?.user?.id) await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
      throw inviteDbError;
    }
    return res.status(200).json({ success: true, message: `Invitation successfully sent to ${email}`, inviteToken });
  } catch (error) {
    return sendApiError(res, error, 'Unable to send invitation.');
  }
}
