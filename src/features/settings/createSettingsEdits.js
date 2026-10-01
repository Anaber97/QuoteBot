import { DEFAULT_CONFIG } from '../../lib/configSchema';

/** Immutable edits to the shared settings draft; persistence is owned by useSettingsDraft. */
export function createSettingsEdits(setFormData, profile) {
  const updatePricing = (field, value) => {
    setFormData(prev => ({
      ...prev,
      pricing: { ...prev.pricing, [field]: value }
    }));
  };

  const updatePricingMode = (field, feeType) => {
    setFormData((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        surchargeModes: {
          ...(prev.pricing?.surchargeModes || {}),
          [field]: feeType,
        },
      },
    }));
  };

  const updateCustomSurcharge = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        custom_surcharges: (prev.pricing?.custom_surcharges || []).map((item) =>
          item.id === id ? { ...item, [field]: field === 'value' ? Number(value) || 0 : value } : item
        ),
      },
    }));
  };

  const addCustomSurcharge = () => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        custom_surcharges: [
          ...(prev.pricing?.custom_surcharges || []),
          { id: `surcharge-${Date.now()}`, name: 'New Custom Surcharge', feeType: 'flat', value: 0, active: true },
        ],
      },
    }));
  };

  const toggleCustomSurcharge = (id) => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        custom_surcharges: (prev.pricing?.custom_surcharges || []).map((item) =>
          item.id === id ? { ...item, active: !item.active } : item
        ),
      },
    }));
  };

  const removeCustomSurcharge = (id) => {
    setFormData((prev) => ({ ...prev, pricing: { ...prev.pricing, custom_surcharges: (prev.pricing?.custom_surcharges || []).filter((item) => item.id !== id) } }));
  };

  const updateClientPortal = (field, value) => {
    setFormData(prev => ({
      ...prev,
      client_portal: { ...prev.client_portal, [field]: value }
    }));
  };

  const updateClientPortalTier = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      client_portal: {
        ...prev.client_portal,
        weight_tiers: (prev.client_portal?.weight_tiers || DEFAULT_CONFIG.client_portal.weight_tiers).map((tier, tierIndex) =>
          tierIndex === index
            ? {
                ...tier,
                [field]: ['rate', 'hourlyRate', 'mileageRate', 'permitCost', 'minWeight', 'maxWeight', 'rounding_interval', 'drive_time_buffer', 'load_unload_base_mins'].includes(field)
                  ? Number(value) || 0
                  : value,
              }
            : tier
        ),
      },
    }));
  };

  const addClientPortalTier = () => {
    setFormData((prev) => ({ ...prev, client_portal: { ...prev.client_portal, weight_tiers: [...(prev.client_portal?.weight_tiers || []), { id: `tier-${Date.now()}`, minWeight: 0, maxWeight: 999999, rate: 0, hourlyRate: 0, mileageRate: 0, permitCost: 150, drive_time_buffer: 10, load_unload_base_mins: 30 }] } }));
  };

  const removeClientPortalTier = (index) => {
    setFormData((prev) => ({ ...prev, client_portal: { ...prev.client_portal, weight_tiers: (prev.client_portal?.weight_tiers || []).filter((_, tierIndex) => tierIndex !== index) } }));
  };

  const reorderClientPortalTier = (index, direction) => {
    setFormData((prev) => {
      const tiers = [...(prev.client_portal?.weight_tiers || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= tiers.length) return prev;
      const [movedTier] = tiers.splice(index, 1);
      tiers.splice(targetIndex, 0, movedTier);
      return { ...prev, client_portal: { ...prev.client_portal, weight_tiers: tiers } };
    });
  };

  const addClientPortalClient = () => {
    const newClient = {
      id: `client-${Date.now()}`,
      company_id: profile?.company_id || null,
      client_name: 'New Client',
      contact_email: '',
      contact_phone: '',
      approval_threshold: null,
      pricing: {
        hourly_min: null,
        hourly_max: null,
        rounding_interval: 25,
        drive_time_buffer: null,
        load_unload_base_mins: null,
        extra_stop_mins: null,
      },
    };

    setFormData(prev => ({
      ...prev,
      client_portal: {
        ...prev.client_portal,
        clients: [...(prev.client_portal?.clients || []), newClient],
      },
    }));
  };

  const removeClientPortalClient = (clientId) => {
    setFormData(prev => ({
      ...prev,
      client_portal: {
        ...prev.client_portal,
        clients: (prev.client_portal?.clients || []).filter((client) => client.id !== clientId),
      },
    }));
  };

  const updateClientPortalClient = (clientId, field, value) => {
    setFormData(prev => ({
      ...prev,
      client_portal: {
        ...prev.client_portal,
        clients: (prev.client_portal?.clients || []).map((client) =>
          client.id === clientId ? { ...client, [field]: value } : client
        ),
      },
    }));
  };

  const updateClientPortalClientPricing = (clientId, field, value) => {
    setFormData(prev => ({
      ...prev,
      client_portal: {
        ...prev.client_portal,
        clients: (prev.client_portal?.clients || []).map((client) =>
          client.id === clientId
            ? {
                ...client,
                pricing: {
                  ...(client.pricing || {}),
                  [field]: value === '' ? null : Number(value),
                },
              }
            : client
        ),
      },
    }));
  };

  const addTruckClass = () => {
    const newClass = { id: Date.now().toString(), name: 'New Equipment Class', minRate: 150, maxRate: 150, minMileageRate: 5, maxMileageRate: 5, drive_time_buffer: 10, load_unload_base_mins: 30 };
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        custom_truck_classes: [...(prev.pricing?.custom_truck_classes || []), newClass]
      }
    }));
  };

  const removeTruckClass = (id) => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        custom_truck_classes: (prev.pricing?.custom_truck_classes || []).filter(t => t.id !== id)
      }
    }));
  };

  const reorderTruckClass = (index, direction) => {
    setFormData((prev) => {
      const classes = [...(prev.pricing?.custom_truck_classes || [])];
      const destination = index + direction;
      if (destination < 0 || destination >= classes.length) return prev;
      [classes[index], classes[destination]] = [classes[destination], classes[index]];
      return { ...prev, pricing: { ...prev.pricing, custom_truck_classes: classes } };
    });
  };

  const addBase = () => {
    const newBase = { id: `b_${Date.now()}`, name: 'New Base Yard', address: '', localCities: [] };
    setFormData(prev => ({ ...prev, bases: [...(prev.bases || []), newBase] }));
  };

  const removeBase = (id) => {
    setFormData(prev => ({ ...prev, bases: (prev.bases || []).filter(b => b.id !== id) }));
  };

  return {
    updatePricing,
    updatePricingMode,
    updateCustomSurcharge,
    addCustomSurcharge,
    toggleCustomSurcharge,
    removeCustomSurcharge,
    updateClientPortal,
    updateClientPortalTier,
    addClientPortalTier,
    removeClientPortalTier,
    reorderClientPortalTier,
    addClientPortalClient,
    removeClientPortalClient,
    updateClientPortalClient,
    updateClientPortalClientPricing,
    addTruckClass,
    removeTruckClass,
    reorderTruckClass,
    addBase,
    removeBase,
  };
}
