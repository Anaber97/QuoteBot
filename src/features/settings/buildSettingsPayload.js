import { normalizeConfig, normalizeClientPortalTier, normalizeDriveTimeBuffer, ROUNDING_OPTIONS } from '../../lib/configSchema.js';

export function buildSettingsPayload(source, companyId) {
  const configToSave = normalizeConfig(source);
      const visibleClients = (configToSave.client_portal?.clients || []).filter((client) => {
        const clientCompanyId = client.company_id || companyId;
        return clientCompanyId === companyId;
      });

      // This is the single canonical shape used by the UI and API.
      // The API also mirrors the core pricing values into the legacy flat
      // app_config columns for backwards compatibility.
      return {
        ...configToSave,
        company_id: companyId,
        pricing: {
          ...configToSave.pricing,
          hourly_rate: Number(configToSave.pricing?.hourly_rate ?? configToSave.pricing?.hourly_min ?? 125),
          hourly_min: Number(configToSave.pricing?.hourly_rate ?? configToSave.pricing?.hourly_min ?? 125),
          hourly_max: Number(configToSave.pricing?.hourly_rate ?? configToSave.pricing?.hourly_min ?? 125),
          mileage_rate: Number(configToSave.pricing?.mileage_rate ?? configToSave.pricing?.mileage_min ?? 5),
          mileage_min: Number(configToSave.pricing?.mileage_rate ?? configToSave.pricing?.mileage_min ?? 5),
          mileage_max: Number(configToSave.pricing?.mileage_rate ?? configToSave.pricing?.mileage_min ?? 5),
          rounding_interval: Number(configToSave.pricing?.rounding_interval ?? 25),
          drive_time_buffer: normalizeDriveTimeBuffer(configToSave.pricing?.drive_time_buffer ?? 10),
          load_unload_base_mins: Number(configToSave.pricing?.load_unload_base_mins ?? 30),
          extra_stop_mins: Number(configToSave.pricing?.extra_stop_mins ?? 15),
          after_hours_multiplier: Number(configToSave.pricing?.after_hours_multiplier ?? 25),
          road_club_multiplier: Number(configToSave.pricing?.road_club_multiplier ?? 15),
          metro_multiplier: Number(configToSave.pricing?.metro_multiplier ?? 28.57),
          hazard_multiplier: Number(configToSave.pricing?.hazard_multiplier ?? 40),
          custom_surcharges: (configToSave.pricing?.custom_surcharges || []).map((item, index) => ({
            id: item.id || `surcharge-${index + 1}`,
            name: item.name || `Custom Surcharge ${index + 1}`,
            feeType: item.feeType || 'flat',
            value: Number(item.value ?? 0),
            active: item.active !== false,
          })),
        },
        surcharges: {
          ...configToSave.surcharges,
          custom_surcharges: (configToSave.pricing?.custom_surcharges || []).map((item, index) => ({
            id: item.id || `surcharge-${index + 1}`,
            name: item.name || `Custom Surcharge ${index + 1}`,
            feeType: item.feeType || 'flat',
            value: Number(item.value ?? 0),
            active: item.active !== false,
          })),
        },
        geofences: {
          disabledZones: configToSave.geofences?.disabledZones || [],
          customZoneRates: configToSave.geofences?.customZoneRates || {},
          customZones: (configToSave.geofences?.customZones || []).map((zone) => ({
            ...zone,
            id: zone.id || `custom-${Date.now()}`,
            type: 'custom',
            pricingMode: zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge'),
            surchargeFeeType: zone.surchargeFeeType || 'percent',
            price: Number(zone.price ?? 0),
            priority: Math.max(0, Math.min(999, Number(zone.priority ?? 0) || 0)),
            shape: Array.isArray(zone.shape) ? zone.shape : [],
          })),
        },
        bases: (configToSave.bases || []).filter(Boolean),
        users: [],
        client_portal: {
          ...configToSave.client_portal,
          approval_threshold: Number(configToSave.client_portal?.approval_threshold ?? 80000),
          rounding_interval: ROUNDING_OPTIONS.includes(Number(configToSave.client_portal?.rounding_interval))
            ? Number(configToSave.client_portal.rounding_interval)
            : 25,
          weight_tiers: (configToSave.client_portal?.weight_tiers || []).map((tier, index) =>
            normalizeClientPortalTier(tier, index)
          ),
          clients: visibleClients.map((client, index) => ({
            id: client.id || `client-${index + 1}`,
            company_id: client.company_id || companyId,
            client_name: client.client_name || client.name || `Client ${index + 1}`,
            contact_email: client.contact_email || '',
            contact_phone: client.contact_phone || '',
            logo_path: client.logo_path || '',
            approval_threshold:
              client.approval_threshold === '' ||
              client.approval_threshold === null ||
              client.approval_threshold === undefined
                ? null
                : Number(client.approval_threshold),
            pricing: {
              hourly_min:
                client.pricing?.hourly_min === '' ||
                client.pricing?.hourly_min === null ||
                client.pricing?.hourly_min === undefined
                  ? null
                  : Number(client.pricing.hourly_min),
              hourly_max:
                client.pricing?.hourly_max === '' ||
                client.pricing?.hourly_max === null ||
                client.pricing?.hourly_max === undefined
                  ? null
                  : Number(client.pricing.hourly_max),
              rounding_interval:
                client.pricing?.rounding_interval === '' ||
                client.pricing?.rounding_interval === null ||
                client.pricing?.rounding_interval === undefined
                  ? 25
                  : Number(client.pricing.rounding_interval),
            },
          })),
        },
      };

}
