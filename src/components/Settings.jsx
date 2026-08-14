// src/components/Settings.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Save, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import CustomGeofenceEditor from './Settings/CustomGeofenceEditor';

import { supabase } from '../lib/supabase';
import { buildInviteEmailPayload } from '../lib/inviteEmail';
import { RATES } from '../config/rates';
import { GEOFENCES, HAZARD_ZONES, METRO_CODE_BY_ZONE_ID } from '../config/geofences';
import { US_STATE_NAMES } from '../config/usStates';
import {
  SettingsTabsNav,
  PricingTab,
  GeofencesTab,
  BasesTab,
  ClientPortalTab,
  UsersTab,
} from './Settings/index';

const normalizeDriveTimeBuffer = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 10;
  if (num > 1.5) return num;
  if (num > 0) return (num - 1) * 100;
  return 10;
};

export const DEFAULT_CONFIG = {
  company_id: '00000000-0000-0000-0000-000000000000',
  pricing: {
    hourly_min: RATES.HOURLY_MIN || 125,
    hourly_max: RATES.HOURLY_MAX || 135,
    rounding_interval: RATES.ROUNDING_INTERVAL || 25,
    drive_time_buffer: (RATES.DRIVE_TIME_BUFFER - 1) * 100 || 10,
    after_hours_multiplier: (RATES.AFTER_HOURS_MULTIPLIER - 1) * 100 || 25,
    road_club_multiplier: (RATES.ROAD_CLUB_MULTIPLIER - 1) * 100 || 15,
    metro_multiplier: 28.57,
    hazard_multiplier: 40,
    surchargeModes: {
      after_hours_multiplier: 'percent',
      road_club_multiplier: 'percent',
      metro_multiplier: 'percent',
      hazard_multiplier: 'percent',
    },
    load_unload_base_mins: RATES.LOAD_UNLOAD_BASE_MINS || 30,
    extra_stop_mins: RATES.EXTRA_STOP_MINS || 15,
    custom_truck_classes: [
      { id: '1', name: 'Standard Tow / Flatbed', minRate: RATES.HOURLY_MIN || 125, maxRate: RATES.HOURLY_MAX || 135 },
      { id: '2', name: 'Medium Duty Flatbed', minRate: 150, maxRate: 180 },
      { id: '3', name: 'Heavy Duty Towing', minRate: 200, maxRate: 250 },
      { id: '4', name: 'Rotator / Heavy Recovery', minRate: 350, maxRate: 450 },
    ],
  },
  surcharges: {
    custom_surcharges: [
      { id: '1', name: 'Winch Out / Off-Road', feeType: 'flat', value: 75, active: true },
      { id: '2', name: 'Bad Weather / Ice', feeType: 'percent', value: 20, active: false },
    ],
  },
  geofences: {
    disabledZones: [],
    customZoneRates: {},
    customZones: [],
  },
  // Base yards are company-specific. Never silently quote from a sample address.
  bases: [],
  users: [],
  client_portal: {
    contact_phone: '(555) 555-0199',
    contact_email: 'quotes@yourcompany.com',
    approval_threshold: 80001,
    rounding_interval: 25,
    disclosure: 'These quotes are electronically generated estimates based on the information provided and may be affected by route conditions, permit requirements, or equipment-specific variables. Please confirm final pricing with a company representative before dispatch.',
    weight_tiers: [
      { id: 'tier-1', label: '0–20,000 lbs', minWeight: 0, maxWeight: 20000, rate: 150 },
      { id: 'tier-2', label: '20,001–40,000 lbs', minWeight: 20001, maxWeight: 40000, rate: 180 },
      { id: 'tier-3', label: '40,001–60,000 lbs', minWeight: 40001, maxWeight: 60000, rate: 200 },
      { id: 'tier-4', label: '60,001–80,000 lbs', minWeight: 60001, maxWeight: 80000, rate: 225 },
      { id: 'tier-5', label: '80,001+ lbs', minWeight: 80001, maxWeight: 999999, rate: 250 },
    ],
    clients: [],
  },
};

const ROUNDING_OPTIONS = [1, 5, 10, 25];

const normalizeClientPortalTier = (tier = {}, index = 0) => ({
  id: tier.id || `tier-${index + 1}`,
  label: tier.label || `Tier ${index + 1}`,
  minWeight: Number(tier.minWeight ?? tier.min ?? 0) || 0,
  maxWeight: Number(tier.maxWeight ?? tier.max ?? 999999) || 999999,
  rate: Number(tier.rate ?? tier.hourly_rate ?? 0) || 0,
  rounding_interval: ROUNDING_OPTIONS.includes(Number(tier.rounding_interval)) ? Number(tier.rounding_interval) : 25,
  drive_time_buffer: Number(tier.drive_time_buffer ?? 10) || 10,
  load_unload_base_mins: Number(tier.load_unload_base_mins ?? 30) || 30,
});

const normalizeConfig = (rawValue = {}) => {
  // app_config has historically stored settings in several places. Treat the
  // JSON "config" column as the oldest source, then let the current columns
  // override it. This makes old and new rows load consistently.
  const value = {
    ...(rawValue.config && typeof rawValue.config === 'object' ? rawValue.config : {}),
    ...rawValue,
  };

  return {
  ...DEFAULT_CONFIG,
  ...value,
  company_id: value.company_id || DEFAULT_CONFIG.company_id,
  pricing: {
    ...(DEFAULT_CONFIG.pricing || {}),
    ...(value.pricing || {}),
    ...(value.surcharges || {}),
    surchargeModes: {
      ...(DEFAULT_CONFIG.pricing?.surchargeModes || {}),
      ...(value.pricing?.surchargeModes || value.surcharges?.surchargeModes || {}),
    },
    rounding_interval: Number(value.pricing?.rounding_interval ?? value.rounding_interval ?? DEFAULT_CONFIG.pricing.rounding_interval) || 25,
    hourly_min: Number(value.pricing?.hourly_min ?? value.hourly_min ?? DEFAULT_CONFIG.pricing.hourly_min) || 125,
    hourly_max: Number(value.pricing?.hourly_max ?? value.hourly_max ?? DEFAULT_CONFIG.pricing.hourly_max) || 135,
    drive_time_buffer: normalizeDriveTimeBuffer(value.pricing?.drive_time_buffer ?? value.drive_time_buffer ?? DEFAULT_CONFIG.pricing.drive_time_buffer),
    after_hours_multiplier: Number(value.pricing?.after_hours_multiplier ?? value.surcharges?.after_hours_multiplier ?? value.after_hours_multiplier ?? DEFAULT_CONFIG.pricing.after_hours_multiplier) || 25,
    road_club_multiplier: Number(value.pricing?.road_club_multiplier ?? value.surcharges?.road_club_multiplier ?? value.road_club_multiplier ?? DEFAULT_CONFIG.pricing.road_club_multiplier) || 15,
    metro_multiplier: Number(value.pricing?.metro_multiplier ?? value.surcharges?.metro_multiplier ?? DEFAULT_CONFIG.pricing.metro_multiplier) || 28.57,
    hazard_multiplier: Number(value.pricing?.hazard_multiplier ?? value.surcharges?.hazard_multiplier ?? DEFAULT_CONFIG.pricing.hazard_multiplier) || 40,
    load_unload_base_mins: Number(value.pricing?.load_unload_base_mins ?? value.load_unload_base_mins ?? DEFAULT_CONFIG.pricing.load_unload_base_mins) || 30,
    extra_stop_mins: Number(value.pricing?.extra_stop_mins ?? value.extra_stop_mins ?? DEFAULT_CONFIG.pricing.extra_stop_mins) || 15,
    custom_surcharges: Array.isArray(value.pricing?.custom_surcharges ?? value.surcharges?.custom_surcharges)
      ? (value.pricing?.custom_surcharges ?? value.surcharges?.custom_surcharges).map((item, index) => ({
          id: item.id || `surcharge-${index + 1}`,
          name: item.name || `Custom Surcharge ${index + 1}`,
          feeType: item.feeType || 'flat',
          value: Number(item.value ?? 0) || 0,
          active: item.active !== false,
        }))
      : DEFAULT_CONFIG.pricing.custom_surcharges,
  },
  surcharges: {
    ...(DEFAULT_CONFIG.surcharges || {}),
    ...(value.surcharges || {}),
    custom_surcharges: Array.isArray(value.pricing?.custom_surcharges ?? value.surcharges?.custom_surcharges)
      ? (value.pricing?.custom_surcharges ?? value.surcharges?.custom_surcharges).map((item, index) => ({
          id: item.id || `surcharge-${index + 1}`,
          name: item.name || `Custom Surcharge ${index + 1}`,
          feeType: item.feeType || 'flat',
          value: Number(item.value ?? 0) || 0,
          active: item.active !== false,
        }))
      : DEFAULT_CONFIG.surcharges.custom_surcharges,
  },
  geofences: {
    disabledZones: value.geofences?.disabledZones || [],
    customZoneRates: value.geofences?.customZoneRates || {},
    customZones: Array.isArray(value.geofences?.customZones) ? value.geofences.customZones.map((zone) => ({
      id: zone.id || `custom-${Math.random().toString(36).slice(2)}`,
      name: zone.name || 'Custom Geofence',
      localityQuery: zone.localityQuery || '',
      city: zone.city || '',
      state: zone.state || '',
      feeType: zone.feeType || 'percent',
      pricingMode: zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge'),
      surchargeFeeType: zone.surchargeFeeType || 'percent',
      price: Number(zone.price ?? 0) || 0,
      shape: Array.isArray(zone.shape) ? zone.shape : [],
      type: 'custom',
    })) : [],
  },
  bases: Array.isArray(value.bases) ? value.bases : DEFAULT_CONFIG.bases,
  users: Array.isArray(value.users) ? value.users.filter(Boolean) : [],
  client_portal: {
    contact_phone: value.client_portal?.contact_phone || DEFAULT_CONFIG.client_portal.contact_phone,
    contact_email: value.client_portal?.contact_email || DEFAULT_CONFIG.client_portal.contact_email,
    approval_threshold: Number(value.client_portal?.approval_threshold ?? DEFAULT_CONFIG.client_portal.approval_threshold) || 80000,
    rounding_interval: ROUNDING_OPTIONS.includes(Number(value.client_portal?.rounding_interval)) ? Number(value.client_portal?.rounding_interval) : 25,
    disclosure: value.client_portal?.disclosure || DEFAULT_CONFIG.client_portal.disclosure,
    weight_tiers: Array.isArray(value.client_portal?.weight_tiers) && value.client_portal.weight_tiers.length > 0
      ? value.client_portal.weight_tiers.map((tier, index) => normalizeClientPortalTier(tier, index))
      : DEFAULT_CONFIG.client_portal.weight_tiers.map((tier, index) => normalizeClientPortalTier(tier, index)),
    clients: Array.isArray(value.client_portal?.clients)
      ? value.client_portal.clients.map((client, index) => ({
          id: client.id || `client-${index + 1}`,
          company_id: client.company_id || value.company_id || null,
          client_name: client.client_name || client.name || `Client ${index + 1}`,
          contact_email: client.contact_email || '',
          contact_phone: client.contact_phone || '',
          approval_threshold: client.approval_threshold === '' || client.approval_threshold === null || client.approval_threshold === undefined
            ? null
            : Number(client.approval_threshold),
          pricing: {
            hourly_min: client.pricing?.hourly_min === '' || client.pricing?.hourly_min === null || client.pricing?.hourly_min === undefined
              ? null
              : Number(client.pricing.hourly_min),
            hourly_max: client.pricing?.hourly_max === '' || client.pricing?.hourly_max === null || client.pricing?.hourly_max === undefined
              ? null
              : Number(client.pricing.hourly_max),
            rounding_interval: client.pricing?.rounding_interval === '' || client.pricing?.rounding_interval === null || client.pricing?.rounding_interval === undefined
              ? 25
              : Number(client.pricing.rounding_interval),
          },
        }))
      : [],
  },
  };
};

const formatRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return 'Manager';
  if (normalized === 'dispatch') return 'Dispatch';
  if (normalized === 'client') return 'Client';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export default function Settings({ config, onSaveConfig, currentUserRole, profile }) {
  const [activeSubTab, setActiveSubTab] = useState('pricing');
  const [formData, setFormData] = useState(() => normalizeConfig(config));
  const [companyUsers, setCompanyUsers] = useState([]);
  const [clientAccounts, setClientAccounts] = useState([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('client');
  const [inviteClientId, setInviteClientId] = useState('');
  const [inviteStatus, setInviteStatus] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [userEdits, setUserEdits] = useState({});
  const [editingUserIds, setEditingUserIds] = useState({});

  // Geofence Search & Filter State
  const [geofenceSearch, setGeofenceSearch] = useState('');
  const [geofenceFilter, setGeofenceFilter] = useState('all');
  const [geofenceStateFilter, setGeofenceStateFilter] = useState('all');
  const [geofenceTypeFilter, setGeofenceTypeFilter] = useState('all');
  const [customSurchargeSearch, setCustomSurchargeSearch] = useState('');
  const [customSurchargeFilter, setCustomSurchargeFilter] = useState('all');
  const [selectedGeofenceId, setSelectedGeofenceId] = useState(null);
  const [draftCustomGeofence, setDraftCustomGeofence] = useState(null);

  useEffect(() => {
    if (config) setFormData(normalizeConfig(config));
  }, [config]);

  useEffect(() => {
    if (!profile?.company_id) {
      setCompanyUsers([]);
      setClientAccounts([]);
      return;
    }

    let isMounted = true;

    const loadCompanyUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, company_id, client_id, created_at')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error('Error loading workspace members:', error);
        setCompanyUsers([]);
        return;
      }

      setCompanyUsers((data || []).filter(Boolean));

      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('company_id', profile.company_id)
        .order('client_name', { ascending: true });
      if (!clientsError) setClientAccounts(clients || []);
    };

    loadCompanyUsers();

    return () => {
      isMounted = false;
    };
  }, [profile?.company_id]);

  const canEdit = currentUserRole === 'manager';

  const handleSave = async (sourceData) => {
  const configSource =
    sourceData && typeof sourceData === 'object' && !('nativeEvent' in sourceData)
      ? sourceData
      : formData;
    const configToSave = normalizeConfig(configSource);
    const companyId = profile?.company_id || configToSave?.company_id;

    if (!companyId) {
      setSaveStatus({ type: 'error', message: 'No company ID found.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const visibleClients = (configToSave.client_portal?.clients || []).filter((client) => {
        const clientCompanyId = client.company_id || companyId;
        return clientCompanyId === companyId;
      });

      // This is the single canonical shape used by the UI and API.
      // The API also mirrors the core pricing values into the legacy flat
      // app_config columns for backwards compatibility.
      const normalizedConfig = {
        ...configToSave,
        company_id: companyId,
        pricing: {
          ...configToSave.pricing,
          hourly_min: Number(configToSave.pricing?.hourly_min ?? 125),
          hourly_max: Number(configToSave.pricing?.hourly_max ?? 135),
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

      const response = await fetch('/api/saveAppConfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          user_id: profile?.id,
          config: normalizedConfig,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || `Settings save failed (${response.status}).`);
      }

      // Use the exact object we sent as the new in-memory source of truth.
      const savedConfig = normalizeConfig(result?.config || normalizedConfig);
      setSaveStatus({ type: 'success', message: 'Configuration saved successfully!' });
      setFormData(savedConfig);
      if (onSaveConfig) onSaveConfig(savedConfig);
    } catch (err) {
      console.error('Error saving app_config:', err);
      setSaveStatus({ type: 'error', message: err.message || 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

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

  const updateSurcharges = (field, value) => {
    setFormData(prev => ({
      ...prev,
      surcharges: { ...prev.surcharges, [field]: value }
    }));
  };

  const updateCustomSurcharge = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        custom_surcharges: (prev.pricing?.custom_surcharges || []).map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: field === 'value' ? Number(value) || 0 : value } : item
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

  const toggleCustomSurcharge = (index) => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        custom_surcharges: (prev.pricing?.custom_surcharges || []).map((item, itemIndex) =>
          itemIndex === index ? { ...item, active: !item.active } : item
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
                [field]: ['rate', 'minWeight', 'maxWeight', 'rounding_interval', 'drive_time_buffer', 'load_unload_base_mins'].includes(field)
                  ? Number(value) || 0
                  : value,
              }
            : tier
        ),
      },
    }));
  };

  const addClientPortalTier = () => {
    setFormData((prev) => ({ ...prev, client_portal: { ...prev.client_portal, weight_tiers: [...(prev.client_portal?.weight_tiers || []), { id: `tier-${Date.now()}`, minWeight: 0, maxWeight: 999999, rate: 0, drive_time_buffer: 10, load_unload_base_mins: 30 }] } }));
  };

  const removeClientPortalTier = (index) => {
    setFormData((prev) => ({ ...prev, client_portal: { ...prev.client_portal, weight_tiers: (prev.client_portal?.weight_tiers || []).filter((_, tierIndex) => tierIndex !== index) } }));
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
    const newClass = { id: Date.now().toString(), name: 'New Equipment Class', minRate: 150, maxRate: 200, drive_time_buffer: 10, load_unload_base_mins: 30 };
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

  const addBase = () => {
    const newBase = { id: `b_${Date.now()}`, name: 'New Base Yard', address: '', localCities: [] };
    setFormData(prev => ({ ...prev, bases: [...(prev.bases || []), newBase] }));
  };

  const removeBase = (id) => {
    setFormData(prev => ({ ...prev, bases: (prev.bases || []).filter(b => b.id !== id) }));
  };

  const handleInviteUser = async () => {
  if (!profile?.company_id) {
    setInviteStatus({ type: 'error', message: 'No company available for this invite.' });
    return;
  }

  const trimmedEmail = inviteEmail.trim().toLowerCase();
  if (!trimmedEmail) {
    setInviteStatus({ type: 'error', message: 'Please enter an email address.' });
    return;
  }

  setIsSaving(true);
  setInviteStatus(null);

  try {
    // 1. Send API request to trigger Supabase Admin Invite
    const response = await fetch("/api/inviteUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: trimmedEmail,
        role: inviteRole,
        company_id: profile?.company_id,
        client_id: inviteRole === 'client' && inviteClientId ? inviteClientId : null,
        invited_by: profile?.id,
        name: inviteName.trim(),
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      }),
    });

    // Check if the endpoint returned valid JSON before parsing
    const contentType = response.headers.get("content-type");
    if (!response.ok || !contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`API error (${response.status}): ${text.slice(0, 100) || 'Invalid server response'}`);
    }

    const apiResult = await response.json();
    if (apiResult.error) throw new Error(apiResult.error);

    // 2. Optionally trigger custom email template function via Supabase Edge Function
    try {
      const emailPayload = buildInviteEmailPayload({
        token: apiResult.inviteToken,
        recipientEmail: trimmedEmail,
        recipientName: inviteName.trim(),
        inviterName: profile?.full_name || 'Your workspace manager',
        companyName: profile?.company_name || 'your workspace',
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      });

      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: emailPayload,
      });

      if (emailError) console.warn('Supabase edge function warning:', emailError);
    } catch (emailErr) {
      console.warn('Invite custom email could not be sent:', emailErr);
    }

    setInviteStatus({
      type: 'success',
      message: `Invite sent to ${trimmedEmail}.`,
    });
    setInviteName('');
    setInviteEmail('');
    setInviteRole('client');
  } catch (err) {
    console.error('Error sending invite:', err);
    setInviteStatus({ type: 'error', message: err.message || 'Failed to send invite.' });
  } finally {
    setIsSaving(false);
  }
};

  const handleEditUser = async (userId) => {
    if (editingUserIds[userId]) {
      const edits = userEdits[userId] || {};
      const nextName = (edits.full_name || '').trim();
      const nextRole = (edits.role || 'client').toLowerCase();

      try {
        setIsSaving(true);
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: nextName || null,
            role: nextRole,
          })
          .eq('id', userId);

        if (error) throw error;

        setCompanyUsers((prev) =>
          prev.map((user) =>
            user.id === userId
              ? { ...user, full_name: nextName || user.full_name || user.email || '', role: nextRole }
              : user
          )
        );

        setUserEdits((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        setEditingUserIds((prev) => ({ ...prev, [userId]: false }));
        setInviteStatus({ type: 'success', message: 'User updated successfully.' });
      } catch (err) {
        console.error('Error updating user:', err);
        setInviteStatus({ type: 'error', message: err.message || 'Failed to update user.' });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const currentUser = companyUsers.find((user) => user.id === userId) || profile;
    setUserEdits((prev) => ({
      ...prev,
      [userId]: {
        full_name: currentUser?.full_name || currentUser?.name || '',
        role: currentUser?.role || 'client',
      },
    }));
    setEditingUserIds((prev) => ({ ...prev, [userId]: true }));
  };

  const toggleGeofence = (id) => {
    const currentDisabled = formData.geofences?.disabledZones || [];
    const updatedDisabled = currentDisabled.includes(id)
      ? currentDisabled.filter(zId => zId !== id)
      : [...currentDisabled, id];

    setFormData(prev => ({
      ...prev,
      geofences: { ...prev.geofences, disabledZones: updatedDisabled }
    }));
  };

  const toggleFilteredGeofences = () => {
    const matchedIds = filteredGeofences.map((zone) => zone.id);
    if (!matchedIds.length) return;

    const currentDisabled = formData.geofences?.disabledZones || [];
    const hasAnyEnabled = matchedIds.some((id) => !currentDisabled.includes(id));
    const updatedDisabled = hasAnyEnabled
      ? [...new Set([...currentDisabled, ...matchedIds])]
      : currentDisabled.filter((id) => !matchedIds.includes(id));

    setFormData(prev => ({
      ...prev,
      geofences: { ...prev.geofences, disabledZones: updatedDisabled },
    }));
  };

  const updateGeofenceOverride = (zoneId, fieldOrValue, maybeValue) => {
    const hasField = maybeValue !== undefined;
    const field = hasField ? fieldOrValue : 'value';
    const rawValue = hasField ? maybeValue : fieldOrValue;
    const nextValue = field === 'value' ? Number(rawValue) || 0 : rawValue;
    setFormData((prev) => ({
      ...prev,
      geofences: {
        ...prev.geofences,
        customZoneRates: {
          ...(prev.geofences?.customZoneRates || {}),
          [zoneId]: {
            ...(prev.geofences?.customZoneRates?.[zoneId] || {}),
            [field]: nextValue,
          },
        },
      },
    }));
  };

  const clearGeofenceOverride = (zoneId) => {
    setFormData((prev) => {
      const nextCustomZoneRates = { ...(prev.geofences?.customZoneRates || {}) };
      delete nextCustomZoneRates[zoneId];

      return {
        ...prev,
        geofences: {
          ...prev.geofences,
          customZoneRates: nextCustomZoneRates,
        },
      };
    });
  };

  const addCustomGeofence = () => {
    const zone = {
      id: `custom-${Date.now()}`,
      name: 'New Municipality Zone',
      localityQuery: '',
      city: '',
      state: '',
      feeType: 'percent',
      price: 25,
      shape: [],
      type: 'custom',
    };
    setDraftCustomGeofence(zone);
    setSelectedGeofenceId(zone.id);
  };

  const updateDraftCustomGeofence = (field, value) => {
    setDraftCustomGeofence((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveCustomGeofence = () => {
    if (!draftCustomGeofence) return;

    const localizedCity = (draftCustomGeofence.city || '').trim();
    const localizedState = (draftCustomGeofence.state || '').trim().toUpperCase();
    const localityQuery = (draftCustomGeofence.localityQuery || [localizedCity, localizedState].filter(Boolean).join(', ')).trim();

    const cleanedZone = {
      ...draftCustomGeofence,
      name: (draftCustomGeofence.name || '').trim() || 'Custom Geofence',
      localityQuery,
      city: localizedCity,
      state: localizedState,
      feeType: draftCustomGeofence.feeType === 'flat' ? 'flat' : 'percent',
      price: Number(draftCustomGeofence.price ?? 0) || 0,
      shape: Array.isArray(draftCustomGeofence.shape) ? draftCustomGeofence.shape : [],
    };

    if (!cleanedZone.name || (!cleanedZone.city && !cleanedZone.state && !cleanedZone.localityQuery)) {
      setSaveStatus({ type: 'error', message: 'A custom geofence needs a label and a locality selection.' });
      return;
    }

    const nextFormData = {
      ...formData,
      geofences: {
        ...formData.geofences,
        customZones: [...(formData.geofences?.customZones || []).filter((zone) => zone.id !== cleanedZone.id), cleanedZone],
      },
    };

    setFormData(nextFormData);
    handleSave(nextFormData);

    setDraftCustomGeofence(null);
    setSelectedGeofenceId(cleanedZone.id);
    setSaveStatus({ type: 'success', message: 'Custom geofence saved and persisted.' });
  };

  const deleteCustomGeofence = (zoneId) => {
    setFormData((prev) => ({
      ...prev,
      geofences: {
        ...prev.geofences,
        customZones: (prev.geofences?.customZones || []).filter((zone) => zone.id !== zoneId),
      },
    }));
    if (draftCustomGeofence?.id === zoneId) {
      setDraftCustomGeofence(null);
    }
    if (selectedGeofenceId === zoneId) {
      setSelectedGeofenceId(null);
    }
  };

  const getZoneState = (cities = []) => {
    const stateCandidate = (cities || [])
      .map((city) => String(city || '').split(',').pop()?.trim().toLowerCase())
      .find((part) => part && part.length <= 3 && /^[a-z]{2}$/.test(part));
    return stateCandidate || null;
  };

  const getStateName = (state) => {
    if (!state) return '';
    return US_STATE_NAMES[String(state).trim().toLowerCase()] || String(state).toUpperCase();
  };

  const allGeofences = useMemo(() => {
    const hazardList = Object.values(HAZARD_ZONES).map((zone) => ({ ...zone, type: 'hazard', state: getZoneState(zone.cities) }));
    const metroList = Object.values(GEOFENCES).map((zone) => ({ ...zone, type: 'metro', state: getZoneState(zone.cities) }));
    const customList = (formData.geofences?.customZones || []).map((zone) => ({
      ...zone,
      type: 'custom',
      state: (zone.state || '').trim().toLowerCase() || null,
    }));
    return [...hazardList, ...metroList, ...customList];
  }, [formData.geofences?.customZones]);

  const filteredGeofences = useMemo(() => {
    return allGeofences.filter((zone) => {
      const matchesType =
        geofenceFilter === 'all' ||
        (geofenceFilter === 'hazard' && zone.type === 'hazard') ||
        (geofenceFilter === 'metro' && zone.type === 'metro') ||
        (geofenceFilter === 'custom' && zone.type === 'custom');

      const matchesState = geofenceStateFilter === 'all' || zone.state === geofenceStateFilter;

      const query = geofenceSearch.toLowerCase();
      const matchesSearch =
        !query ||
        zone.name.toLowerCase().includes(query) ||
        String(METRO_CODE_BY_ZONE_ID[String(zone.id)] || '').toLowerCase().includes(query) ||
        String(zone.state || '').toLowerCase().includes(query) ||
        getStateName(zone.state).toLowerCase().includes(query) ||
        (zone.cities || []).some((city) => city.toLowerCase().includes(query));

      return matchesType && matchesState && matchesSearch;
    });
  }, [allGeofences, geofenceFilter, geofenceStateFilter, geofenceSearch]);

  const disabledSet = new Set(formData.geofences?.disabledZones || []);
  const customSurchargeItems = useMemo(() => {
    const items = formData.pricing?.custom_surcharges || [];
    const query = customSurchargeSearch.toLowerCase();

    return items.filter((item) => {
      const matchesFilter =
        customSurchargeFilter === 'all' ||
        (customSurchargeFilter === 'active' && item.active !== false) ||
        (customSurchargeFilter === 'inactive' && item.active === false);
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [formData.pricing?.custom_surcharges, customSurchargeFilter, customSurchargeSearch]);
  const selectedGeofence = allGeofences.find((zone) => zone.id === selectedGeofenceId) || null;
  const selectGeofence = (zoneId) => {
    setSelectedGeofenceId(zoneId);
    const customZone = (formData.geofences?.customZones || []).find((zone) => zone.id === zoneId);
    setDraftCustomGeofence(customZone ? { ...customZone } : null);
  };
  const geofenceStateOptions = useMemo(
    () => Array.from(new Set(allGeofences.map((zone) => zone.state))).filter(Boolean).sort(),
    [allGeofences]
  );

  if (!canEdit) {
    return (
      <div className="p-8 text-center bg-[#0c1019] border border-red-800/40 rounded-xl my-4">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Access Restricted</h3>
        <p className="text-xs text-slate-400">Settings & Configuration are restricted to authorized workspace roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <SettingsTabsNav
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        allGeofencesCount={allGeofences.length}
      />

      {/* SUB TAB 1: PRICING */}
      {activeSubTab === 'pricing' && (
        <PricingTab
          formData={formData}
          updatePricing={updatePricing}
          updatePricingMode={updatePricingMode}
          addTruckClass={addTruckClass}
          removeTruckClass={removeTruckClass}
          customSurchargeItems={customSurchargeItems}
          addCustomSurcharge={addCustomSurcharge}
          toggleCustomSurcharge={toggleCustomSurcharge}
          removeCustomSurcharge={removeCustomSurcharge}
          updateCustomSurcharge={updateCustomSurcharge}
          customSurchargeSearch={customSurchargeSearch}
          setCustomSurchargeSearch={setCustomSurchargeSearch}
          customSurchargeFilter={customSurchargeFilter}
          setCustomSurchargeFilter={setCustomSurchargeFilter}
          updateClientPortalTier={updateClientPortalTier}
          addClientPortalTier={addClientPortalTier}
          removeClientPortalTier={removeClientPortalTier}
        />
      )}

      {/* SUB TAB 2: GEOFENCES */}
      {activeSubTab === 'geofences' && (
        <GeofencesTab
          geofenceSearch={geofenceSearch}
          setGeofenceSearch={setGeofenceSearch}
          geofenceFilter={geofenceFilter}
          setGeofenceFilter={setGeofenceFilter}
          geofenceStateFilter={geofenceStateFilter}
          setGeofenceStateFilter={setGeofenceStateFilter}
          filteredGeofences={filteredGeofences}
          disabledSet={disabledSet}
          toggleGeofence={toggleGeofence}
          toggleFilteredGeofences={toggleFilteredGeofences}
          updateGeofenceOverride={updateGeofenceOverride}
          clearGeofenceOverride={clearGeofenceOverride}
          selectedGeofence={selectedGeofence}
          setSelectedGeofenceId={selectGeofence}
          formData={formData}
          geofenceStateOptions={geofenceStateOptions}
          addCustomGeofence={addCustomGeofence}
          saveCustomGeofence={saveCustomGeofence}
          deleteCustomGeofence={deleteCustomGeofence}
          draftCustomGeofence={draftCustomGeofence}
          updateDraftCustomGeofence={updateDraftCustomGeofence}
        />
      )}

      {/* SUB TAB 4: BASES */}
      {activeSubTab === 'bases' && (
        <BasesTab formData={formData} addBase={addBase} removeBase={removeBase} setFormData={setFormData} />
      )}

      {/* SUB TAB 5: CLIENT PORTAL */}
      {activeSubTab === 'client_portal' && (
        <ClientPortalTab
          formData={formData}
          profile={profile}
          updateClientPortal={updateClientPortal}
          updateClientPortalTier={updateClientPortalTier}
          addClientPortalClient={addClientPortalClient}
          removeClientPortalClient={removeClientPortalClient}
          updateClientPortalClient={updateClientPortalClient}
          updateClientPortalClientPricing={updateClientPortalClientPricing}
          onSaveConfig={handleSave}
          isSaving={isSaving}
        />
      )}

      {/* SUB TAB 6: USERS */}
      {activeSubTab === 'users' && (
        <UsersTab
          inviteName={inviteName}
          setInviteName={setInviteName}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          inviteClientId={inviteClientId}
          setInviteClientId={setInviteClientId}
          clientAccounts={clientAccounts}
          handleInviteUser={handleInviteUser}
          isSaving={isSaving}
          inviteStatus={inviteStatus}
          companyUsers={companyUsers}
          profile={profile}
          userEdits={userEdits}
          editingUserIds={editingUserIds}
          handleEditUser={handleEditUser}
          setUserEdits={setUserEdits}
          formatRole={formatRole}
        />
      )}

      {/* Action Footer */}
      {activeSubTab !== 'clients' && activeSubTab !== 'users' && (
        <div className="sticky bottom-0 z-20 bg-[#0c1019] pt-4 border-t border-slate-800 flex items-center justify-between">
          {saveStatus ? (
            <p className={`text-xs font-medium flex items-center gap-1.5 ${saveStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {saveStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {saveStatus.message}
            </p>
          ) : <span />}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer shadow-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
