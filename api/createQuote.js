import { calculateAuthoritativeQuote } from './_quoteEngine.js';
import { computeServerRoute, resolveGoogleLocalities } from './_routes.js';
import { sendStoredApprovalEmail } from './_approvalEmail.js';
import { enforceRateLimit, requireUser, sendApiError } from './_security.js';

const text = (value, maximum = 240) => String(value || '').trim().slice(0, maximum);
const number = (value, maximum = 10_000_000) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(0, parsed)) : 0;
};

export function normalizeQuoteInput(body, profile) {
  const rawWaypoints = Array.isArray(body.waypoints) ? body.waypoints : [];
  const waypoints = rawWaypoints.map((value) => text(value, 500)).filter(Boolean).slice(0, 24);
  if (waypoints.length < 2) throw Object.assign(new Error('Pickup and dropoff addresses are required.'), { status: 400 });
  const client = profile.role === 'client';
  return {
    baseId: text(body.baseId, 120),
    waypoints,
    quoteSource: client ? 'client_portal' : (body.quoteSource === 'equipment_calculator' ? 'equipment_calculator' : 'main_calculator'),
    selectedTruckClassId: text(body.selectedTruckClassId, 120),
    isHeavy: Boolean(body.isHeavy),
    isAfterHours: client ? false : Boolean(body.isAfterHours),
    isRoadClub: client ? false : Boolean(body.isRoadClub),
    activeOverrides: client ? {} : (body.activeOverrides && typeof body.activeOverrides === 'object' ? body.activeOverrides : {}),
    customRate: client ? null : number(body.customRate, 100000),
    customLoadUnloadMins: client ? null : (body.customLoadUnloadMins == null ? null : number(body.customLoadUnloadMins, 10080)),
    customerName: text(body.customerName, 160),
    customerPhone: text(body.customerPhone, 60),
    notes: text(body.notes, 2000),
    equipment: {
      name: text(body.equipment?.name || body.equipment?.equipmentName, 160),
      make: text(body.equipment?.make, 120), model: text(body.equipment?.model, 120), serialNumber: text(body.equipment?.serialNumber, 120),
      weight: number(body.equipment?.weight), width: number(body.equipment?.width, 10000), height: number(body.equipment?.height, 10000),
      attachmentType: text(body.equipment?.attachmentType, 120), attachmentWeight: number(body.equipment?.attachmentWeight),
    },
  };
}

function mergeConfig(row) {
  const legacy = row?.config && typeof row.config === 'object' ? row.config : {};
  return {
    ...legacy, ...row,
    pricing: { ...(legacy.pricing || {}), ...(row?.pricing || {}) },
    surcharges: { ...(legacy.surcharges || {}), ...(row?.surcharges || {}) },
    geofences: { ...(legacy.geofences || {}), ...(row?.geofences || {}) },
    client_portal: { ...(legacy.client_portal || {}), ...(row?.client_portal || {}) },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { admin, profile } = await requireUser(req);
    await enforceRateLimit(admin, `create-quote:${profile.id}`, { limit: 60, windowMs: 60 * 60 * 1000 });
    const input = normalizeQuoteInput(body, profile);
    const { data: configRow, error: configError } = await admin.from('app_config').select('*').eq('company_id', profile.company_id).single();
    if (configError || !configRow) throw Object.assign(new Error('Company pricing is not configured.'), { status: 400 });
    const config = mergeConfig(configRow);
    const base = (Array.isArray(config.bases) ? config.bases : []).find((item) => String(item.id) === input.baseId)
      || (Array.isArray(config.bases) ? config.bases[0] : null);
    if (!base?.address) throw Object.assign(new Error('A valid company base is required.'), { status: 400 });

    let clientConfig = null;
    if (profile.role === 'client') {
      if (!profile.client_id) throw Object.assign(new Error('Your user is not assigned to a client account.'), { status: 403 });
      const { data, error } = await admin.from('clients').select('id, company_id, client_name, contact_email, contact_phone, approval_threshold, pricing').eq('id', profile.client_id).eq('company_id', profile.company_id).single();
      if (error || !data) throw Object.assign(new Error('Client pricing is not configured.'), { status: 400 });
      clientConfig = data;
    }

    const routeAddresses = [base.address, ...input.waypoints, base.address];
    const route = await computeServerRoute(routeAddresses);
    route.localities = (config?.geofences?.customZones || []).length > 0
      ? await resolveGoogleLocalities(input.waypoints)
      : [];
    const calculated = calculateAuthoritativeQuote({ input, config, clientConfig, route, role: profile.role });
    const payload = {
      company_id: profile.company_id, user_id: profile.id, client_id: profile.role === 'client' ? profile.client_id : null,
      quote_source: input.quoteSource, customer_name: input.customerName, customer_phone: input.customerPhone,
      pickup_address: input.waypoints[0], dropoff_address: input.waypoints.at(-1), all_waypoints: input.waypoints,
      base_yard_id: String(base.id), truck_class: input.selectedTruckClassId,
      total_miles: calculated.totalMiles, total_hours: calculated.totalHours,
      min_quote: calculated.minQuote, max_quote: calculated.maxQuote, custom_quote: calculated.customQuote,
      status: calculated.approvalRequired ? 'approval_required' : 'submitted',
      notes: input.notes,
      applied_surcharges: calculated.appliedSurcharges,
      quote_details: { ...calculated.quoteDetails, approvalRequired: calculated.approvalRequired, metroCodes: calculated.metroCodes, routeLegs: calculated.routeLegs },
    };
    const { data: quote, error: insertError } = await admin.from('quote_logs').insert(payload).select('*').single();
    if (insertError) throw insertError;

    let notificationWarning = '';
    if (profile.role === 'client' && calculated.approvalRequired) {
      try { await sendStoredApprovalEmail(admin, profile, quote); }
      catch (error) { console.error('Stored quote approval notification failed:', error); notificationWarning = 'Quote saved, but its approval email could not be sent.'; }
    }
    return res.status(201).json({ success: true, quote, notificationWarning });
  } catch (error) {
    const provider = String(error?.message || '').toLowerCase().includes('google') ? 'maps' : 'database';
    return sendApiError(res, error, 'Unable to create quote.', { route: '/api/createQuote', provider });
  }
}
