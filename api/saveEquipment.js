import { enforceRateLimit, requireUser, sendApiError } from './_security.js';
import { equipmentScope, normalizeSavedEquipment, SAVED_EQUIPMENT_COLUMNS } from './_savedEquipment.js';

export function validateEquipment(body) {
  const clean = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  const make = clean(body?.make);
  const model = clean(body?.model);
  const serial_number = clean(body?.serial_number) || null;
  if (!make || !model || make.length > 80 || model.length > 80 || (serial_number?.length || 0) > 100) {
    throw Object.assign(new Error('Enter a make and model (up to 80 characters each). Serial numbers can be up to 100 characters.'), { status: 400 });
  }
  const fields = { operating_weight_lbs: 2000000, width_in: 2000, height_in: 2000 };
  const specs = {};
  for (const [field, max] of Object.entries(fields)) {
    const raw = body?.[field];
    const value = ['number', 'string'].includes(typeof raw) ? Number(raw) : NaN;
    if (!Number.isFinite(value) || value <= 0 || value > max) {
      throw Object.assign(new Error('Enter a valid positive operating weight, width, and height.'), { status: 400 });
    }
    specs[field] = value;
  }
  return { make, model, serial_number, ...specs,
    equipment_key: JSON.stringify([make, model, serial_number || ''].map((value) => value.toLowerCase())),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { admin, profile } = await requireUser(req);
    const scope = equipmentScope(profile);
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: 'Invalid equipment data.' }); }
    const item = validateEquipment(body);
    await enforceRateLimit(admin, `equipment-save:${profile.id}`, { limit: 60, windowMs: 3600000 });
    if (scope.client_id) {
      const { data: client, error } = await admin.from('clients').select('id')
        .eq('id', scope.client_id).eq('company_id', scope.company_id).maybeSingle();
      if (error || !client) return res.status(403).json({ error: 'Client account is unavailable.' });
    }
    const { data, error } = await admin.from('saved_equipment').upsert({
      ...item, ...scope, updated_by: profile.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,client_id,equipment_key' }).select(SAVED_EQUIPMENT_COLUMNS).single();
    if (error) throw error;
    return res.status(200).json({ equipment: normalizeSavedEquipment(data), scope: scope.client_id ? 'client' : 'company' });
  } catch (error) {
    return sendApiError(res, error, 'Could not save equipment. Please try again.', { route: '/api/saveEquipment' });
  }
}
