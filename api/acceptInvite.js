import { createUserClient, requireAuth, sendApiError } from './_security.js';
import { PRIVACY_VERSION as CURRENT_PRIVACY_VERSION, TERMS_VERSION as CURRENT_TERMS_VERSION } from '../src/legal/legalContent.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const token = String(body.token || '').trim();
    const fullName = String(body.fullName || '').trim().slice(0, 120);
    const termsVersion = String(body.termsVersion || '').trim();
    const privacyVersion = String(body.privacyVersion || '').trim();
    if (!token) return res.status(400).json({ error: 'Invite token is required.' });
    if (termsVersion !== CURRENT_TERMS_VERSION || privacyVersion !== CURRENT_PRIVACY_VERSION) {
      return res.status(400).json({ error: 'You must accept the current Terms of Use and acknowledge the current Privacy Policy.' });
    }
    const { user, token: accessToken } = await requireAuth(req);
    const userClient = createUserClient(accessToken);
    const { data, error } = await userClient.rpc('accept_company_invite', { p_token: token, p_user_id: user.id, p_full_name: fullName, p_terms_version: termsVersion, p_privacy_version: privacyVersion });
    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (message.includes('invalid invitation token') || message.includes('no longer valid')) return res.status(404).json({ error: 'This invite is no longer valid. Please request a new one.' });
      if (message.includes('expired')) return res.status(410).json({ error: 'This invite has expired. Please request a new one.' });
      if (message.includes('does not match authenticated user')) return res.status(403).json({ error: 'This invite belongs to a different email address.' });
      throw error;
    }
    if (!Array.isArray(data) || data.length === 0) throw new Error('Unable to complete invite acceptance.');
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendApiError(res, error, 'Unable to accept invite.');
  }
}
