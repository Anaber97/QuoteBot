import React from 'react';
import { DollarSign, Clock, Plus, Trash2, Percent, ToggleLeft, ToggleRight } from 'lucide-react';

export default function PricingTab({
  formData,
  updatePricing,
  addTruckClass,
  removeTruckClass,
  customSurchargeItems,
  addCustomSurcharge,
  toggleCustomSurcharge,
  updateCustomSurcharge,
  customSurchargeSearch,
  setCustomSurchargeSearch,
  customSurchargeFilter,
  setCustomSurchargeFilter,
}) {
  return (
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
              onChange={(e) => updatePricing('hourly_min', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Max Rate ($/hr)</label>
            <input
              type="number"
              value={formData.pricing?.hourly_max ?? 135}
              onChange={(e) => updatePricing('hourly_max', parseFloat(e.target.value) || 0)}
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
              onChange={(e) => updatePricing('rounding_interval', parseInt(e.target.value))}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white"
            >
              <option value={1}>Exact ($1)</option>
              <option value={5}>Nearest $5</option>
              <option value={10}>Nearest $10</option>
              <option value={25}>Nearest $25 (Default)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Drive Time Buffer (%)</label>
            <input
              type="number"
              step="1"
              value={formData.pricing?.drive_time_buffer ?? 10}
              onChange={(e) => updatePricing('drive_time_buffer', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
            <span className="text-[9px] text-slate-500">e.g. 10 = +10% traffic pad</span>
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Load / Unload Flat (Mins)</label>
            <input
              type="number"
              value={formData.pricing?.load_unload_base_mins ?? 30}
              onChange={(e) => updatePricing('load_unload_base_mins', parseInt(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
        <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
          <Percent className="w-4 h-4 text-amber-400" /> Standard Multipliers (%)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">After Hours (%)</label>
            <input
              type="number"
              value={formData.pricing?.after_hours_multiplier ?? 25}
              onChange={(e) => updatePricing('after_hours_multiplier', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Road Club (%)</label>
            <input
              type="number"
              value={formData.pricing?.road_club_multiplier ?? 15}
              onChange={(e) => updatePricing('road_club_multiplier', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Metro (%)</label>
            <input
              type="number"
              value={formData.pricing?.metro_multiplier ?? 28.57}
              onChange={(e) => updatePricing('metro_multiplier', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Hazard (%)</label>
            <input
              type="number"
              value={formData.pricing?.hazard_multiplier ?? 40}
              onChange={(e) => updatePricing('hazard_multiplier', parseFloat(e.target.value) || 0)}
              className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-bold text-slate-200 text-xs">Custom Surcharges</h4>
            <p className="text-[10px] text-slate-400">Filter and toggle optional fees without leaving the pricing tab.</p>
          </div>
          <button
            type="button"
            onClick={addCustomSurcharge}
            className="flex items-center gap-1 text-[11px] bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/30 transition cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Surcharge
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Search surcharges"
            value={customSurchargeSearch}
            onChange={(e) => setCustomSurchargeSearch(e.target.value)}
            className="flex-1 bg-[#121824] border border-slate-700 rounded p-2 text-white text-xs"
          />
          <select
            value={customSurchargeFilter}
            onChange={(e) => setCustomSurchargeFilter(e.target.value)}
            className="bg-[#121824] border border-slate-700 rounded p-2 text-white text-xs"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="space-y-2">
          {customSurchargeItems.map((item, idx) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-[#121824] p-2.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => toggleCustomSurcharge(idx)}
                className={`rounded-full p-1 ${item.active !== false ? 'text-emerald-400' : 'text-slate-500'}`}
              >
                {item.active !== false ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              </button>
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateCustomSurcharge(idx, 'name', e.target.value)}
                className="flex-1 bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs"
              />
              <select
                value={item.feeType || 'flat'}
                onChange={(e) => updateCustomSurcharge(idx, 'feeType', e.target.value)}
                className="bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs"
              >
                <option value="flat">Flat</option>
                <option value="percent">Percent</option>
              </select>
              <input
                type="number"
                value={item.value ?? 0}
                onChange={(e) => updateCustomSurcharge(idx, 'value', e.target.value)}
                className="w-24 bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs font-mono"
              />
            </div>
          ))}
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
              onChange={(e) => {
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
                  onChange={(e) => {
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
                  onChange={(e) => {
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
  );
}
