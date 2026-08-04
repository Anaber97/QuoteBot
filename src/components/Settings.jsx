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
  users: [
    { id: 'u1', name: 'Dave Dispatcher', email: 'dave@towco.com', role: 'dispatch' },
    { id: 'u2', name: 'Sarah Office', email: 'sarah@towco.com', role: 'office' },
    { id: 'u3', name: 'External Client', email: 'client@acme.com', role: 'client' }
  ]
};

export default function Settings({ config, onSaveConfig, currentUserRole, profile }) {
  const [activeSubTab, setActiveSubTab] = useState('pricing');
  const [formData, setFormData] = useState(config || DEFAULT_CONFIG);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Geofence Search & Filter State
  const [geofenceSearch, setGeofenceSearch] = useState('');
  const [geofenceFilter, setGeofenceFilter] = useState('all');
  const [editingZoneId, setEditingZoneId] = useState(null);

  useEffect(() => {
    if (config) setFormData(config);
  }, [config]);

  const canEdit = currentUserRole === 'manager' || currentUserRole === 'dispatch' || currentUserRole === 'office';

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
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const dataToSave = {
        ...formData,
        company_id: profile?.company_id || formData.company_id
      };
      await onSaveConfig(dataToSave);
      setSaveStatus({ type: 'success', message: 'Configuration saved successfully!' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to save configuration.' });
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
        custom_truck_classes: [...(prev.pricing.custom_truck_classes || []), newClass]
      }
    }));
  };

  const removeTruckClass = (id) => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        custom_truck_classes: prev.pricing.custom_truck_classes.filter(t => t.id !== id)
      }
    }));
  };

  const addBase = () => {
    const newBase = { id: `b_${Date.now()}`, name: 'New Base Location', address: '', phone: '' };
    setFormData(prev => ({ ...prev, bases: [...prev.bases, newBase] }));
  };

  const removeBase = (id) => {
    setFormData(prev => ({ ...prev, bases: prev.bases.filter(b => b.id !== id) }));
  };

  const addUser = () => {
    const newUser = { id: `u_${Date.now()}`, name: 'New Team Member', email: '', role: 'dispatch' };
    setFormData(prev => ({ ...prev, users: [...prev.users, newUser] }));
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

  const setCustomZoneRate = (id, percentValue) => {
    setFormData(prev => ({
      ...prev,
      geofences: {
        ...prev.geofences,
        customZoneRates: {
          ...(prev.geofences?.customZoneRates || {}),
          [id]: percentValue
        }
      }
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
                  value={formData.pricing.hourly_min}
                  onChange={e => updatePricing('hourly_min', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Max Rate ($/hr)</label>
                <input
                  type="number"
                  value={formData.pricing.hourly_max}
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
                  value={formData.pricing.rounding_interval}
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
                  value={formData.pricing.drive_time_buffer}
                  onChange={e => updatePricing('drive_time_buffer', parseFloat(e.target.value) || 1)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
                <span className="text-[9px] text-slate-500">e.g. 1.10 = +10% traffic pad</span>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Load / Unload Flat (Mins)</label>
                <input
                  type="number"
                  value={formData.pricing.load_unload_base_mins}
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

            {formData.pricing.custom_truck_classes?.map((tc, idx) => (
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
                    className="text-red-400 hover:text-red-300 p-1 cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
            <h4 className="font-bold text-slate-200 text-xs">Global Flat Percentage Multipliers (%)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-amber-300 block mb-1">After Hours (%)</label>
                <input
                  type="number"
                  value={formData.surcharges.after_hours_multiplier}
                  onChange={e => updateSurcharges('after_hours_multiplier', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-indigo-300 block mb-1">Road Club (%)</label>
                <input
                  type="number"
                  value={formData.surcharges.road_club_multiplier}
                  onChange={e => updateSurcharges('road_club_multiplier', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-cyan-300 block mb-1">Default Metro (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.surcharges.metro_multiplier}
                  onChange={e => updateSurcharges('metro_multiplier', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-rose-300 block mb-1">Default Hazard (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.surcharges.hazard_multiplier}
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
          <div className="flex flex-col sm:flex-row gap-2 justify-between items-center bg-[#080c14] p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search 50+ cities, states, passes..."
                value={geofenceSearch}
                onChange={e => setGeofenceSearch(e.target.value)}
                className="w-full bg-[#121824] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {[
                { id: 'all', label: `All (${allGeofences.length})` },
                { id: 'metro', label: `Metro (${Object.keys(GEOFENCES).length})` },
                { id: 'hazard', label: `Hazard (${Object.keys(HAZARD_ZONES).length})` },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setGeofenceFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    geofenceFilter === f.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#121824] text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex justify-between items-center px-1">
            <span>Showing {filteredGeofences.length} geofences</span>
            <span className="text-slate-500">Click percentage badge or edit button to adjust custom zone rate</span>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredGeofences.map(zone => {
              const isDisabled = disabledSet.has(zone.id);
              const isHazard = zone.type === 'hazard';

              const defaultTypeRate = isHazard
                ? formData.surcharges.hazard_multiplier
                : formData.surcharges.metro_multiplier;

              const customRateOverride = formData.geofences?.customZoneRates?.[zone.id];
              const effectivePercent = customRateOverride !== undefined 
                ? customRateOverride 
                : Math.round((zone.multiplier - 1) * 100) || defaultTypeRate;

              const isEditingThisZone = editingZoneId === zone.id;

              return (
                <div
                  key={zone.id}
                  className={`p-3 rounded-xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                    isDisabled
                      ? 'bg-[#080c14]/50 border-slate-800/50 opacity-60'
                      : isHazard
                      ? 'bg-rose-950/20 border-rose-900/40'
                      : 'bg-[#080c14] border-slate-800'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      {isHazard ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                      <span className="font-bold text-white text-xs">{zone.name}</span>

                      {isEditingThisZone ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            value={effectivePercent}
                            onChange={e => setCustomZoneRate(zone.id, parseFloat(e.target.value) || 0)}
                            className="w-16 bg-[#121824] border border-blue-500 rounded px-1.5 py-0.5 text-[10px] text-white font-mono"
                          />
                          <span className="text-[10px] text-slate-400">%</span>
                          <button
                            type="button"
                            onClick={() => setEditingZoneId(null)}
                            className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold"
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingZoneId(zone.id)}
                          title="Click to edit custom surcharge percentage"
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition cursor-pointer ${
                            customRateOverride !== undefined
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : isHazard
                              ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                          }`}
                        >
                          +{effectivePercent}%
                          <Edit3 className="w-2.5 h-2.5 opacity-70" />
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400 line-clamp-1">
                      <strong className="text-slate-300">Cities:</strong> {zone.cities.join(', ')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleGeofence(zone.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                      isDisabled
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isDisabled ? 'Disabled' : <><Check className="w-3 h-3" /> Active</>}
                  </button>
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
            <h4 className="font-bold text-slate-200 text-xs">Shop Base Locations</h4>
            <button
              type="button"
              onClick={addBase}
              className="flex items-center gap-1 text-[11px] bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/30 transition cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add Base
            </button>
          </div>

          {formData.bases?.map((base, idx) => (
            <div key={base.id} className="bg-[#080c14] p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center gap-2">
                <input
                  type="text"
                  placeholder="Base Name"
                  value={base.name}
                  onChange={e => {
                    const updated = [...formData.bases];
                    updated[idx].name = e.target.value;
                    setFormData(prev => ({ ...prev, bases: updated }));
                  }}
                  className="bg-[#121824] border border-slate-700 rounded px-2.5 py-1 text-white font-bold text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeBase(base.id)}
                  className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Full Street Address"
                value={base.address}
                onChange={e => {
                  const updated = [...formData.bases];
                  updated[idx].address = e.target.value;
                  setFormData(prev => ({ ...prev, bases: updated }));
                }}
                className="w-full bg-[#121824] border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs"
              />
            </div>
          ))}
        </div>
      )}

      {/* SUB TAB 5: USERS & ROLES */}
      {activeSubTab === 'users' && (
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-bold text-slate-200 text-xs">Team Profiles & Permissions</h4>
              <p className="text-[10px] text-slate-400">Users logging in with Magic Links receive these assigned roles.</p>
            </div>
            <button
              type="button"
              onClick={addUser}
              className="flex items-center gap-1 text-[11px] bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/30 transition cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add User
            </button>
          </div>

          <div className="space-y-2">
            {formData.users?.map((usr, idx) => (
              <div key={usr.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-[#080c14] p-3 rounded-xl border border-slate-800 items-center">
                <div className="sm:col-span-4">
                  <label className="text-[9px] text-slate-500 uppercase block sm:hidden">Name</label>
                  <input
                    type="text"
                    placeholder="User Name"
                    value={usr.name}
                    onChange={e => {
                      const updated = [...formData.users];
                      updated[idx].name = e.target.value;
                      setFormData(prev => ({ ...prev, users: updated }));
                    }}
                    className="w-full bg-[#121824] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="text-[9px] text-slate-500 uppercase block sm:hidden">Email</label>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={usr.email}
                    onChange={e => {
                      const updated = [...formData.users];
                      updated[idx].email = e.target.value;
                      setFormData(prev => ({ ...prev, users: updated }));
                    }}
                    className="w-full bg-[#121824] border border-slate-700 rounded px-2.5 py-1.5 text-slate-300 text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[9px] text-slate-500 uppercase block sm:hidden">Role</label>
                  <select
                    value={usr.role}
                    onChange={e => {
                      const updated = [...formData.users];
                      updated[idx].role = e.target.value;
                      setFormData(prev => ({ ...prev, users: updated }));
                    }}
                    className="w-full bg-[#121824] border border-slate-700 rounded px-2 py-1.5 text-xs font-semibold text-white"
                  >
                    <option value="dispatch">Dispatch (Full)</option>
                    <option value="office">Office (Settings)</option>
                    <option value="client">Client (Calc Only)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      {activeSubTab !== 'clients' && (
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
            {isSaving ? 'Saving Configuration...' : 'Save Configuration'}
          </button>
        </div>
      )}
    </div>
  );
}