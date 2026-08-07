import React from 'react';
import { Search, MapPin, ToggleLeft, ToggleRight, Plus } from 'lucide-react';
import CustomGeofenceEditor from './CustomGeofenceEditor';

export default function GeofencesTab({
  geofenceSearch,
  setGeofenceSearch,
  geofenceFilter,
  setGeofenceFilter,
  geofenceStateFilter,
  setGeofenceStateFilter,
  filteredGeofences,
  disabledSet,
  toggleGeofence,
  toggleGeofenceState,
  updateGeofenceOverride,
  clearGeofenceOverride,
  selectedGeofence,
  setSelectedGeofenceId,
  formData,
  geofenceStateOptions,
  addCustomGeofence,
  saveCustomGeofence,
  deleteCustomGeofence,
  draftCustomGeofence,
  updateDraftCustomGeofence,
}) {
  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search geofences by name, state, or city..."
            value={geofenceSearch}
            onChange={(e) => setGeofenceSearch(e.target.value)}
            className="w-full bg-[#080c14] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex gap-2">
            <button type="button" onClick={() => setGeofenceFilter('all')} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${geofenceFilter === 'all' ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-800 text-slate-400'}`}>All</button>
            <button type="button" onClick={() => setGeofenceFilter('hazard')} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${geofenceFilter === 'hazard' ? 'bg-rose-600 border-rose-500 text-white' : 'border-slate-800 text-slate-400'}`}>Hazards</button>
            <button type="button" onClick={() => setGeofenceFilter('metro')} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${geofenceFilter === 'metro' ? 'bg-cyan-600 border-cyan-500 text-white' : 'border-slate-800 text-slate-400'}`}>Metro</button>
            <button type="button" onClick={() => setGeofenceFilter('custom')} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${geofenceFilter === 'custom' ? 'bg-violet-600 border-violet-500 text-white' : 'border-slate-800 text-slate-400'}`}>Custom</button>
          </div>
          <div className="flex gap-2">
            <select value={geofenceStateFilter} onChange={(e) => setGeofenceStateFilter(e.target.value)} className="bg-[#080c14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
              <option value="all">All states</option>
              {geofenceStateOptions.map((state) => (
                <option key={state} value={state}>{state.toUpperCase()}</option>
              ))}
            </select>
            {geofenceStateFilter !== 'all' && (
              <button type="button" onClick={() => toggleGeofenceState(geofenceStateFilter)} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-semibold text-slate-300">
                Toggle state
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Custom municipality geofences</p>
          <p className="text-[10px] text-slate-400">Draw a polygon and assign a price surcharge for a specific city/state.</p>
        </div>
        <button type="button" onClick={addCustomGeofence} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-semibold text-slate-300">
          <Plus className="w-3.5 h-3.5" /> New custom zone
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
          {filteredGeofences.map((zone) => {
            const isDisabled = disabledSet.has(zone.id);
            const hasOverride = Boolean(formData?.geofences?.customZoneRates?.[zone.id]);
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => setSelectedGeofenceId(zone.id)}
                className={`text-left p-3 rounded-xl border transition ${isDisabled ? 'bg-[#080c14]/40 border-slate-800/50 opacity-60' : 'bg-[#080c14] border-slate-800'} ${selectedGeofence?.id === zone.id ? 'ring-1 ring-blue-500/40' : ''}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <MapPin className={`w-3.5 h-3.5 ${zone.type === 'hazard' ? 'text-rose-400' : 'text-cyan-400'}`} />
                    {zone.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{zone.state?.toUpperCase() || 'OTHER'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-400 line-clamp-1">{zone.cities?.join(', ')}</p>
                  {hasOverride && <span className="text-[10px] text-amber-400">Custom</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3 space-y-3">
          {draftCustomGeofence ? (
            <CustomGeofenceEditor
              zone={draftCustomGeofence}
              onChange={updateDraftCustomGeofence}
              onSave={saveCustomGeofence}
              onDelete={() => deleteCustomGeofence(draftCustomGeofence.id)}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-700 p-3 text-center text-[10px] text-slate-500">
              Select a geofence to edit its multiplier or create a custom municipality polygon to add a location-specific pricing rule.
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Selected geofence</p>
              <p className="font-semibold text-white">{selectedGeofence?.name || 'Select a geofence'}</p>
            </div>
            {selectedGeofence && (
              <button type="button" onClick={() => toggleGeofence(selectedGeofence.id)} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${disabledSet.has(selectedGeofence.id) ? 'border-slate-700 text-slate-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
                {disabledSet.has(selectedGeofence.id) ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
                {disabledSet.has(selectedGeofence.id) ? 'Disabled' : 'Active'}
              </button>
            )}
          </div>

          {selectedGeofence && (
            <>
              <div className="rounded-lg border border-slate-800 bg-[#121824] p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Type</span>
                  <span className="capitalize text-slate-300">{selectedGeofence.type}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Default multiplier</span>
                  <span className="text-slate-300">{Number(selectedGeofence.multiplier).toFixed(2)}x</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 block">Override multiplier (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData?.geofences?.customZoneRates?.[selectedGeofence.id]?.multiplier ?? ''}
                    onChange={(e) => updateGeofenceOverride(selectedGeofence.id, e.target.value)}
                    placeholder="Leave blank for default"
                    className="flex-1 bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
                  />
                  <button type="button" onClick={() => clearGeofenceOverride(selectedGeofence.id)} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] text-slate-300">Clear</button>
                </div>
                <p className="text-[10px] text-slate-500">Use a percentage like 28.57 for a metro-style surcharge or 40 for a hazard-style surcharge.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
