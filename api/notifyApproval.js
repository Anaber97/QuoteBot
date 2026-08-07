import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase environment variables are not configured.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const emailBody = {
      to: payload.email || 'quotes@yourcompany.com',
      subject: `Custom quote approval requested for ${payload.equipmentName || 'a client load'}`,
      html: `
        <p>A client quote exceeded the approval threshold.</p>
        <ul>
          <li>Company: ${payload.companyName || 'Unknown'}</li>
          <li>Equipment: ${payload.equipmentName || 'Unknown'}</li>
          <li>Estimated weight: ${payload.weight || 0} lbs</li>
          <li>Pickup: ${payload.pickupAddr || 'N/A'}</li>
          <li>Dropoff: ${payload.dropoffAddr || 'N/A'}</li>
        </ul>
        <p>Please review the quote and contact the client at ${payload.contactPhone || 'N/A'} or ${payload.contactEmail || 'N/A'}.</p>
      `,
    };

    const { error } = await supabase.functions.invoke('send-quote-approval-email', { body: emailBody });
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Approval notification failed:', error);
    return res.status(500).json({ error: error.message || 'Approval notification failed.' });
  }
}
