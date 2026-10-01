export const SAVED_EQUIPMENT_COLUMNS = 'id, make, model, serial_number, operating_weight_lbs, width_in, height_in, updated_at';

export function equipmentScope(profile) {
  if (!profile?.company_id || !['manager', 'dispatch', 'client'].includes(profile.role)) {
    throw Object.assign(new Error('A company account is required.'), { status: 403 });
  }
  if (profile.role === 'client' && !profile.client_id) {
    throw Object.assign(new Error('Your user is not assigned to a client account.'), { status: 403 });
  }
  return { company_id: profile.company_id, client_id: profile.role === 'client' ? profile.client_id : null };
}

export function scopeEquipmentQuery(query, scope) {
  const scoped = query.eq('company_id', scope.company_id);
  return scope.client_id ? scoped.eq('client_id', scope.client_id) : scoped.is('client_id', null);
}

export function normalizeSavedEquipment(item) {
  return {
    ...item, id: `saved-${item.id}`, source: 'my equipment',
    confidence: 'LOW', confidence_reason: 'Your saved equipment — manually entered specs',
    requires_confirmation: true, verification_status: 'Unverified', sources: [],
  };
}
