// src/components/Settings.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Save, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { authenticatedFetch } from '../lib/api';
import { DEFAULT_CONFIG, normalizeConfig, normalizeClientPortalTier, normalizeDriveTimeBuffer, ROUNDING_OPTIONS } from '../lib/configSchema';
import { GEOFENCES, HAZARD_ZONES, METRO_CODE_BY_ZONE_ID } from '../config/geofences';
import { US_STATE_NAMES } from '../config/usStates';
import {
  SettingsTabsNav,
  PricingTab,
  GeofencesTab,
  BasesTab,
  ClientPortalTab,
  UsersTab,
  BrandingTab,
} from './Settings/index';


const formatRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return 'Manager';
  if (normalized === 'dispatch') return 'Dispatch';
  if (normalized === 'client') return 'Client';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const cloneNormalizedConfig = (value) => JSON.parse(JSON.stringify(normalizeConfig(value)));

export default function Settings({ config, onSaveConfig, currentUserRole, profile }) {
  const [activeSubTab, setActiveSubTab] = useState('pricing');
  const [formData, setFormDataState] = useState(() => cloneNormalizedConfig(config));
  const [editRevision, setEditRevision] = useState(0);
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
  const [customSurchargeSearch, setCustomSurchargeSearch] = useState('');
  const [customSurchargeFilter, setCustomSurchargeFilter] = useState('all');
  const [selectedGeofenceId, setSelectedGeofenceId] = useState(null);
  const [draftCustomGeofence, setDraftCustomGeofence] = useState(null);

  const setFormData = (update) => {
    setFormDataState(update);
    setEditRevision((revision) => revision + 1);
    setSaveStatus(null);
  };

  useEffect(() => {
    if (config) {
      setFormDataState(cloneNormalizedConfig(config));
      setEditRevision(0);
    }
  }, [config]);

  const hasUnsavedChanges = editRevision > 0;

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
  const updateBranding = (field, value) => setFormData((prev) => ({ ...prev, branding: { ...(prev.branding || {}), [field]: value } }));

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

      const response = await authenticatedFetch('/api/saveAppConfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
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
      setFormDataState(cloneNormalizedConfig(savedConfig));
      setEditRevision(0);
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
    const response = await authenticatedFetch("/api/inviteUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: trimmedEmail,
        role: inviteRole,
        company_id: profile?.company_id,
        client_id: inviteRole === 'client' && inviteClientId ? inviteClientId : null,
        name: inviteName.trim(),
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
      priority: 0,
      shape: [],
      type: 'custom',
    };
    setDraftCustomGeofence(zone);
    setSelectedGeofenceId(zone.id);
  };

  const updateDraftCustomGeofence = (field, value) => {
    setDraftCustomGeofence((prev) => (prev ? { ...prev, [field]: value } : prev));
    const savedZones = formData.geofences?.customZones || [];
    if (draftCustomGeofence?.id && savedZones.some((zone) => zone.id === draftCustomGeofence.id)) {
      setFormData((prev) => ({
        ...prev,
        geofences: {
          ...prev.geofences,
          customZones: (prev.geofences?.customZones || []).map((zone) => (
            zone.id === draftCustomGeofence.id ? { ...zone, [field]: value } : zone
          )),
        },
      }));
    }
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
      priority: Math.max(0, Math.min(999, Number(draftCustomGeofence.priority ?? 0) || 0)),
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

    setDraftCustomGeofence(null);
    setSelectedGeofenceId(cleanedZone.id);
    setSaveStatus(null);
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
    <div className="flex h-[calc(100dvh-11rem)] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0c1019] lg:h-[calc(100dvh-8.5rem)]">
      {/* Sub-navigation Tabs */}
      <SettingsTabsNav
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        allGeofencesCount={allGeofences.length}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">

      {/* SUB TAB 1: PRICING */}
      {activeSubTab === 'pricing' && (
        <PricingTab
          formData={formData}
          updatePricing={updatePricing}
          updatePricingMode={updatePricingMode}
          addTruckClass={addTruckClass}
          removeTruckClass={removeTruckClass}
          reorderTruckClass={reorderTruckClass}
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
          updateClientPortal={updateClientPortal}
        />
      )}

      {/* SUB TAB 2: GEOFENCES */}
      {activeSubTab === 'branding' && <BrandingTab formData={formData} profile={profile} updateBranding={updateBranding} />}

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
      </div>

      {/* Action Footer */}
      {activeSubTab !== 'clients' && activeSubTab !== 'users' && (
        <div className="z-30 flex flex-none items-center justify-between gap-4 border-t border-slate-800 bg-[#0c1019] px-3 py-3 shadow-[0_-10px_24px_rgba(0,0,0,0.2)] sm:px-4">
          {saveStatus?.type === 'error' ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <AlertCircle className="w-4 h-4" />
              {saveStatus.message}
            </p>
          ) : hasUnsavedChanges ? (
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <AlertCircle className="w-4 h-4" />
              Unsaved changes — click Save Settings to apply them.
            </p>
          ) : saveStatus ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              {saveStatus.message}
            </p>
          ) : <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><CheckCircle2 className="w-4 h-4" />All settings saved</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer shadow-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Settings' : 'Saved'}
          </button>
        </div>
      )}
    </div>
  );
}
