// src/components/Settings.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, 
  DollarSign, 
  Percent, 
  MapPin, 
  Users, 
  Truck, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Check,
  AlertTriangle,
  Building2,
  Edit3
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { buildInviteEmailPayload } from '../lib/inviteEmail';
import { RATES } from '../config/rates';
import { SHOP_LOCATIONS } from '../config/locations';
import { GEOFENCES, HAZARD_ZONES } from '../config/geofences';
import ManagerOnboarding from './ManagerOnboarding';

export const DEFAULT_CONFIG = {
  company_id: '00000000-0000-0000-0000-000000000000',
  pricing: {
    hourly_min: RATES.HOURLY_MIN || 125,
    hourly_max: RATES.HOURLY_MAX || 135,
    rounding_interval: RATES.ROUNDING_INTERVAL || 25,
    drive_time_buffer: RATES.DRIVE_TIME_BUFFER || 1.10,
    load_unload_base_mins: RATES.LOAD_UNLOAD_BASE_MINS || 30,
    extra_stop_mins: RATES.EXTRA_STOP_MINS || 15,
    custom_truck_classes: [
      { id: '1', name: 'Standard Tow / Flatbed', minRate: RATES.HOURLY_MIN || 125, maxRate: RATES.HOURLY_MAX || 135 },
      { id: '2', name: 'Medium Duty Flatbed', minRate: 150, maxRate: 180 },
      { id: '3', name: 'Heavy Duty Towing', minRate: 200, maxRate: 250 },
      { id: '4', name: 'Rotator / Heavy Recovery', minRate: 350, maxRate: 450 }
    ]
  },
  surcharges: {
    after_hours_multiplier: (RATES.AFTER_HOURS_MULTIPLIER - 1) * 100 || 25,
    road_club_multiplier: (RATES.ROAD_CLUB_MULTIPLIER - 1) * 100 || 15,
    metro_multiplier: 28.57,
    hazard_multiplier: 40,
    custom_surcharges: [
      { id: '1', name: 'Winch Out / Off-Road', feeType: 'flat', value: 75, active: true },
      { id: '2', name: 'Bad Weather / Ice', feeType: 'percent', value: 20, active: false }
    ]
  },
  geofences: {
    disabledZones: [],
    customZoneRates: {}
  },
  bases: SHOP_LOCATIONS,
  users: []
};

const normalizeConfig = (value = {}) => ({
  ...DEFAULT_CONFIG,
  ...value,
  company_id: value.company_id || DEFAULT_CONFIG.company_id,
  pricing: {
    ...(DEFAULT_CONFIG.pricing || {}),
    ...(value.pricing || {}),
    rounding_interval: Number(value.pricing?.rounding_interval ?? value.rounding_interval ?? DEFAULT_CONFIG.pricing.rounding_interval) || 25,
    hourly_min: Number(value.pricing?.hourly_min ?? value.hourly_min ?? DEFAULT_CONFIG.pricing.hourly_min) || 125,
    hourly_max: Number(value.pricing?.hourly_max ?? value.hourly_max ?? DEFAULT_CONFIG.pricing.hourly_max) || 135,
    drive_time_buffer: Number(value.pricing?.drive_time_buffer ?? value.drive_time_buffer ?? DEFAULT_CONFIG.pricing.drive_time_buffer) || 1.1,
    load_unload_base_mins: Number(value.pricing?.load_unload_base_mins ?? value.load_unload_base_mins ?? DEFAULT_CONFIG.pricing.load_unload_base_mins) || 30,
    extra_stop_mins: Number(value.pricing?.extra_stop_mins ?? value.extra_stop_mins ?? DEFAULT_CONFIG.pricing.extra_stop_mins) || 15,
  },
  surcharges: {
    ...(DEFAULT_CONFIG.surcharges || {}),
    ...(value.surcharges || {}),
  },
  geofences: {
    disabledZones: value.geofences?.disabledZones || [],
    customZoneRates: value.geofences?.customZoneRates || {},
  },
  bases: Array.isArray(value.bases) && value.bases.length > 0 ? value.bases : DEFAULT_CONFIG.bases,
  users: Array.isArray(value.users) ? value.users.filter(Boolean) : [],
});

const formatRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return 'Manager';
  if (normalized === 'dispatch') return 'Dispatch';
  if (normalized === 'client') return 'Client';
  if (normalized === 'member') return 'Member';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export default function Settings({ config, onSaveConfig, currentUserRole, profile }) {
  const [activeSubTab, setActiveSubTab] = useState('pricing');
  const [formData, setFormData] = useState(() => normalizeConfig(config));
  const [companyUsers, setCompanyUsers] = useState([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('client');
  const [inviteStatus, setInviteStatus] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [userEdits, setUserEdits] = useState({});
  const [editingUserIds, setEditingUserIds] = useState({});

  // Geofence Search & Filter State
  const [geofenceSearch, setGeofenceSearch] = useState('');
  const [geofenceFilter, setGeofenceFilter] = useState('all');

  useEffect(() => {
    if (config) setFormData(normalizeConfig(config));
  }, [config]);

  useEffect(() => {
    if (!profile?.company_id) {
      setCompanyUsers([]);
      return;
    }

    let isMounted = true;

    const loadCompanyUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, company_id, created_at')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error('Error loading workspace members:', error);
        setCompanyUsers([]);
        return;
      }

      setCompanyUsers((data || []).filter(Boolean));
    };

    loadCompanyUsers();

    return () => {
      isMounted = false;
    };
  }, [profile?.company_id]);

  const canEdit = currentUserRole === 'manager';

  if (!canEdit) {
    return (
      <div className="p-8 text-center bg-[#0c1019] border border-red-800/40 rounded-xl my-4">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Access Restricted</h3>
        <p className="text-xs text-slate-400">
          Settings & Configuration are restricted to authorized workspace roles.
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    const companyId = profile?.company_id || formData?.company_id;
    if (!companyId) {
      setSaveStatus({ type: 'error', message: 'No company ID found.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const normalizedConfig = {
        company_id: companyId,
        hourly_min: formData.pricing?.hourly_min || 125,
        hourly_max: formData.pricing?.hourly_max || 135,
        rounding_interval: formData.pricing?.rounding_interval || 25,
        drive_time_buffer: formData.pricing?.drive_time_buffer || 1.10,
        load_unload_base_mins: formData.pricing?.load_unload_base_mins || 30,
        extra_stop_mins: formData.pricing?.extra_stop_mins || 15,
        after_hours_multiplier: formData.surcharges?.after_hours_multiplier || 25,
        road_club_multiplier: formData.surcharges?.road_club_multiplier || 15,
        metro_multiplier: formData.surcharges?.metro_multiplier || 28.57,
        hazard_multiplier: formData.surcharges?.hazard_multiplier || 40,
        pricing: {
          ...(DEFAULT_CONFIG.pricing || {}),
          ...(formData.pricing || {})
        },
        surcharges: {
          ...(DEFAULT_CONFIG.surcharges || {}),
          ...(formData.surcharges || {})
        },
        geofences: {
          disabledZones: formData.geofences?.disabledZones || [],
          customZoneRates: formData.geofences?.customZoneRates || {}
        },
        bases: (formData.bases || []).filter(Boolean),
        users: [],
        updated_at: new Date().toISOString()
      };

      const payload = normalizedConfig;

      const { error } = await supabase
        .from('app_config')
        .upsert(payload, { onConflict: 'company_id' });

      if (error) throw error;

      setSaveStatus({ type: 'success', message: 'Configuration saved successfully!' });
      if (onSaveConfig) onSaveConfig(normalizedConfig);
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

  const updateSurcharges = (field, value) => {
    setFormData(prev => ({
      ...prev,
      surcharges: { ...prev.surcharges, [field]: value }
    }));
  };

  const addTruckClass = () => {
    const newClass = { id: Date.now().toString(), name: 'New Equipment Class', minRate: 150, maxRate: 200 };
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
    const token = crypto.randomUUID();

    // 1. Send API request to trigger Supabase Admin Invite
    const response = await fetch("/api/inviteUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail }), // Fixed: passing trimmedEmail
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
        token,
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

  const allGeofences = useMemo(() => {
    const hazardList = Object.values(HAZARD_ZONES).map(z => ({ ...z, type: 'hazard' }));
    const metroList = Object.values(GEOFENCES).map(z => ({ ...z, type: 'metro' }));
    return [...hazardList, ...metroList];
  }, []);

  const filteredGeofences = useMemo(() => {
    return allGeofences.filter(zone => {
      const matchesType = 
        geofenceFilter === 'all' || 
        (geofenceFilter === 'hazard' && zone.type === 'hazard') || 
        (geofenceFilter === 'metro' && zone.type === 'metro');

      const query = geofenceSearch.toLowerCase();
      const matchesSearch = 
        !query || 
        zone.name.toLowerCase().includes(query) || 
        zone.cities.some(c => c.toLowerCase().includes(query));

      return matchesType && matchesSearch;
    });
  }, [allGeofences, geofenceFilter, geofenceSearch]);

  const disabledSet = new Set(formData.geofences?.disabledZones || []);

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 border-b border-slate-800 pb-1">
        {[
          { id: 'pricing', label: 'Pricing', icon: DollarSign },
          { id: 'surcharges', label: 'Surcharges', icon: Percent },
          { id: 'geofences', label: `Geofences (${allGeofences.length})`, icon: MapPin },
          { id: 'bases', label: 'Bases', icon: Truck },
          { id: 'users', label: 'Users & Roles', icon: Users },
          ...(currentUserRole === 'manager' ? [{ id: 'clients', label: 'Client Accounts', icon: Building2 }] : []),
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-t-lg transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#1a2234] text-blue-400 border-b-2 border-blue-500 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1522]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* CLIENT SUB-ACCOUNTS TAB (Manager Only) */}
      {activeSubTab === 'clients' && currentUserRole === 'manager' && (
        <ManagerOnboarding profile={profile} />
      )}

      {/* SUB TAB 1: PRICING */}
      {activeSubTab === 'pricing' && (
        <div className="space-y-5 text-xs">
          <div className="bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Standard Tow Rates ($/hr)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Min Rate ($/hr)</label>
                <input
                  type="number"
                  value={formData.pricing?.hourly_min ?? 125}
                  onChange={e => updatePricing('hourly_min', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Max Rate ($/hr)</label>
                <input
                  type="number"
                  value={formData.pricing?.hourly_max ?? 135}
                  onChange={e => updatePricing('hourly_max', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-400" /> Time & Calculation Defaults
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Rounding Interval ($)</label>
                <select
                  value={formData.pricing?.rounding_interval ?? 25}
                  onChange={e => updatePricing('rounding_interval', parseInt(e.target.value))}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white"
                >
                  <option value={1}>Exact ($1)</option>
                  <option value={5}>Nearest $5</option>
                  <option value={10}>Nearest $10</option>
                  <option value={25}>Nearest $25 (Default)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Drive Time Buffer (Multiplier)</label>
                <input
                  type="number"
                  step="0.05"
                  value={formData.pricing?.drive_time_buffer ?? 1.10}
                  onChange={e => updatePricing('drive_time_buffer', parseFloat(e.target.value) || 1)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
                <span className="text-[9px] text-slate-500">e.g. 1.10 = +10% traffic pad</span>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Load / Unload Flat (Mins)</label>
                <input
                  type="number"
                  value={formData.pricing?.load_unload_base_mins ?? 30}
                  onChange={e => updatePricing('load_unload_base_mins', parseInt(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-200 text-xs">Truck & Equipment Classes ($/hr)</h4>
                <p className="text-[10px] text-slate-400">Custom rates loaded into the Calculator dropdown.</p>
              </div>
              <button
                type="button"
                onClick={addTruckClass}
                className="flex items-center gap-1 text-[11px] bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/30 transition cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Class
              </button>
            </div>
            {formData.pricing?.custom_truck_classes?.map((tc, idx) => (
              <div key={tc.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#121824] p-2.5 rounded-lg border border-slate-800">
                <input
                  type="text"
                  placeholder="Class Name"
                  value={tc.name}
                  onChange={e => {
                    const updated = [...formData.pricing.custom_truck_classes];
                    updated[idx].name = e.target.value;
                    updatePricing('custom_truck_classes', updated);
                  }}
                  className="flex-1 bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs"
                />
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Min $/hr:</span>
                    <input
                      type="number"
                      value={tc.minRate}
                      onChange={e => {
                        const updated = [...formData.pricing.custom_truck_classes];
                        updated[idx].minRate = parseFloat(e.target.value) || 0;
                        updatePricing('custom_truck_classes', updated);
                      }}
                      className="w-20 bg-[#080c14] border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Max $/hr:</span>
                    <input
                      type="number"
                      value={tc.maxRate}
                      onChange={e => {
                        const updated = [...formData.pricing.custom_truck_classes];
                        updated[idx].maxRate = parseFloat(e.target.value) || 0;
                        updatePricing('custom_truck_classes', updated);
                      }}
                      className="w-20 bg-[#080c14] border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTruckClass(tc.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB TAB 2: SURCHARGES */}
      {activeSubTab === 'surcharges' && (
        <div className="space-y-4 text-xs">
          <div className="bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-200 text-xs">Standard Percentage Multipliers (%)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">After Hours (%)</label>
                <input
                  type="number"
                  value={formData.surcharges?.after_hours_multiplier ?? 25}
                  onChange={e => updateSurcharges('after_hours_multiplier', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Road Club (%)</label>
                <input
                  type="number"
                  value={formData.surcharges?.road_club_multiplier ?? 15}
                  onChange={e => updateSurcharges('road_club_multiplier', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Metro Traffic (%)</label>
                <input
                  type="number"
                  value={formData.surcharges?.metro_multiplier ?? 28.57}
                  onChange={e => updateSurcharges('metro_multiplier', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Hazard Zone (%)</label>
                <input
                  type="number"
                  value={formData.surcharges?.hazard_multiplier ?? 40}
                  onChange={e => updateSurcharges('hazard_multiplier', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 3: GEOFENCES */}
      {activeSubTab === 'geofences' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row gap-2 justify-between">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search geofences by name or city..."
                value={geofenceSearch}
                onChange={e => setGeofenceSearch(e.target.value)}
                className="w-full bg-[#080c14] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGeofenceFilter('all')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${geofenceFilter === 'all' ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-800 text-slate-400'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setGeofenceFilter('hazard')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${geofenceFilter === 'hazard' ? 'bg-rose-600 border-rose-500 text-white' : 'border-slate-800 text-slate-400'}`}
              >
                Hazards
              </button>
              <button
                type="button"
                onClick={() => setGeofenceFilter('metro')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${geofenceFilter === 'metro' ? 'bg-cyan-600 border-cyan-500 text-white' : 'border-slate-800 text-slate-400'}`}
              >
                Metro
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
            {filteredGeofences.map(zone => {
              const isDisabled = disabledSet.has(zone.id);
              return (
                <div key={zone.id} className={`p-3 rounded-xl border transition ${isDisabled ? 'bg-[#080c14]/40 border-slate-800/50 opacity-60' : 'bg-[#080c14] border-slate-800'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <MapPin className={`w-3.5 h-3.5 ${zone.type === 'hazard' ? 'text-rose-400' : 'text-cyan-400'}`} />
                      {zone.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleGeofence(zone.id)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isDisabled ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}
                    >
                      {isDisabled ? 'Disabled' : 'Active'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{zone.cities?.join(', ')}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB TAB 4: BASES */}
      {activeSubTab === 'bases' && (
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-slate-200">Dispatch Base Yards</h4>
            <button
              type="button"
              onClick={addBase}
              className="flex items-center gap-1 text-[11px] bg-blue-600/20 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/30"
            >
              <Plus className="w-3 h-3" /> Add Yard
            </button>
          </div>
          {(formData.bases || []).map((base, idx) => (
            <div key={base.id} className="flex flex-col sm:flex-row gap-2 bg-[#080c14] p-3 rounded-xl border border-slate-800">
              <input
                type="text"
                placeholder="Yard Name"
                value={base.name}
                onChange={e => {
                  const updated = [...formData.bases];
                  updated[idx].name = e.target.value;
                  setFormData(prev => ({ ...prev, bases: updated }));
                }}
                className="bg-[#121824] border border-slate-700 rounded px-2.5 py-1.5 text-white flex-1"
              />
              <input
                type="text"
                placeholder="Physical Address"
                value={base.address}
                onChange={e => {
                  const updated = [...formData.bases];
                  updated[idx].address = e.target.value;
                  setFormData(prev => ({ ...prev, bases: updated }));
                }}
                className="bg-[#121824] border border-slate-700 rounded px-2.5 py-1.5 text-white flex-1"
              />
              <button
                type="button"
                onClick={() => removeBase(base.id)}
                className="p-1.5 text-slate-500 hover:text-red-400 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SUB TAB 5: USERS */}
      {activeSubTab === 'users' && (
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-200">Invite User</h4>
              <span className="text-[10px] text-slate-500">Invite-based access</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_0.7fr_auto]">
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
              >
                <option value="client">Client</option>
                <option value="dispatch">Dispatch</option>
                <option value="manager">Manager</option>
              </select>
              <button
                type="button"
                onClick={handleInviteUser}
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                {isSaving ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
            {inviteStatus && (
              <p className={`text-[11px] ${inviteStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {inviteStatus.message}
              </p>
            )}
          </div>

          <div className="flex justify-between items-center">
            <h4 className="font-bold text-slate-200">Workspace Members</h4>
            <span className="text-[10px] text-slate-500">Loaded from Supabase</span>
          </div>

          {companyUsers.length === 0 && !profile?.email && (
            <div className="rounded-lg border border-dashed border-slate-800 bg-[#080c14] p-3 text-[11px] text-slate-500">
              No workspace members found yet.
            </div>
          )}

          {(companyUsers.length > 0 ? companyUsers : profile ? [profile] : []).map((user) => {
            const draft = userEdits[user.id] || {};
            const currentName = draft.full_name ?? user.full_name ?? user.name ?? '';
            const currentRole = draft.role ?? user.role ?? 'client';
            const isEditing = Boolean(editingUserIds[user.id]);

            return (
              <div key={user.id} className="flex flex-col gap-2 bg-[#080c14] p-3 rounded-xl border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-white">
                        {isEditing ? currentName || 'Workspace Member' : user.full_name || user.name || user.email || 'Workspace Member'}
                      </div>
                      <div className="text-[11px] text-slate-400">{user.email || 'No email on file'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                      {formatRole(isEditing ? currentRole : user.role || currentRole)}
                    </span>
                    {user.id === profile?.id && (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        You
                      </span>
                    )}
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => handleEditUser(user.id)}
                        disabled={isSaving}
                        className="rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:border-blue-500/40 hover:text-white disabled:opacity-60"
                      >
                        Edit User
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                    <input
                      type="text"
                      value={currentName}
                      onChange={(e) =>
                        setUserEdits((prev) => ({
                          ...prev,
                          [user.id]: { ...prev[user.id], full_name: e.target.value },
                        }))
                      }
                      placeholder="Name"
                      className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
                    />
                    <select
                      value={currentRole}
                      onChange={(e) =>
                        setUserEdits((prev) => ({
                          ...prev,
                          [user.id]: { ...prev[user.id], role: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
                    >
                      <option value="client">Client</option>
                      <option value="dispatch">Dispatch</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleEditUser(user.id)}
                      disabled={isSaving}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-3 py-2 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-600/30 disabled:opacity-60"
                    >
                      Save
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Footer */}
      {activeSubTab !== 'clients' && activeSubTab !== 'users' && (
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
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
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      )}
    </div>
  );
}