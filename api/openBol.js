import { createAdminClient } from './_security.js';
import { verifyBolAccess } from './_bolAccess.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const quoteId = String(req.query?.quote || '').trim();
  const expiresAt = Number(req.query?.expires);
  const signature = String(req.query?.signature || '').trim();
  if (!verifyBolAccess(quoteId, expiresAt, signature)) return res.status(403).send('This BOL link is invalid or has expired.');

  const admin = createAdminClient();
  const { data: quote, error } = await admin.from('quote_logs').select('bol_path').eq('id', quoteId).single();
  if (error || !quote?.bol_path) return res.status(404).send('BOL not found.');
  const secondsRemaining = Math.max(30, Math.min(300, expiresAt - Math.floor(Date.now() / 1000)));
  const { data, error: signedUrlError } = await admin.storage.from('quote-bols').createSignedUrl(quote.bol_path, secondsRemaining);
  if (signedUrlError || !data?.signedUrl) return res.status(500).send('BOL could not be opened.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.redirect(302, data.signedUrl);
}
