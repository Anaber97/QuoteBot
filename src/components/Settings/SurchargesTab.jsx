import React from 'react';

export default function SurchargesTab({ formData, updateSurcharges }) {
  return (
    <div className="space-y-4 text-xs">
      <div className="bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
        <h4 className="font-bold text-slate-200 text-xs">Standard Percentage Multipliers (%)</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">After Hours (%)</label>
            <input
              type="number"
              value={formData.surcharges?.after_hours_multiplier ?? 25}
              onChange={(e) => updateSurcharges('after_hours_multiplier', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Road Club (%)</label>
            <input
              type="number"
              value={formData.surcharges?.road_club_multiplier ?? 15}
              onChange={(e) => updateSurcharges('road_club_multiplier', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Metro Traffic (%)</label>
            <input
              type="number"
              value={formData.surcharges?.metro_multiplier ?? 28.57}
              onChange={(e) => updateSurcharges('metro_multiplier', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Hazard Zone (%)</label>
            <input
              type="number"
              value={formData.surcharges?.hazard_multiplier ?? 40}
              onChange={(e) => updateSurcharges('hazard_multiplier', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
