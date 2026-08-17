import React from 'react';
import { DollarSign, Clock, Plus, Trash2, Percent } from 'lucide-react';

export default function PricingTab({
  formData,
  updatePricing,
  updatePricingMode,
  addTruckClass,
  removeTruckClass,
  customSurchargeItems,
  addCustomSurcharge,
  toggleCustomSurcharge,
  removeCustomSurcharge,
  updateCustomSurcharge,
  customSurchargeSearch,
  setCustomSurchargeSearch,
  customSurchargeFilter,
  setCustomSurchargeFilter,
  updateClientPortalTier,
  addClientPortalTier,
  removeClientPortalTier,
}) {
  const renderSurchargeControl = (field, label, defaultValue) => {
    const feeType = formData.pricing?.surchargeModes?.[field] || 'percent';
    const unitLabel = feeType === 'flat' ? '$' : '%';

    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="text-[10px] text-slate-400 block">{label} ({unitLabel})</label>
          <button
            type="button"
            onClick={() => updatePricingMode(field, feeType === 'flat' ? 'percent' : 'flat')}
            className={`light-surcharge-type-toggle inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${feeType === 'flat' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900/60 text-slate-300'}`}
          >
            {feeType === 'flat' ? 'Flat $' : 'Percent %'}
          </button>
        </div>
        <input
          type="number"
          value={formData.pricing?.[field] ?? defaultValue}
          onChange={(e) => updatePricing(field, parseFloat(e.target.value) || 0)}
          className="w-full bg-[#121824] border border-slate-700 rounded p-2 text-white font-mono"
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 text-xs">
      <div className="hidden">
        <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-emerald-400" /> Truck & Equipment Classes — Standard Rates ($/hr)
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

      <div className="order-2 bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between"><div><h4 className="font-bold text-slate-200 text-xs">Equipment Weight Pricing</h4><p className="text-[10px] text-slate-400">Used by the Equipment Calculator for one fixed client-facing price.</p></div><button type="button" onClick={addClientPortalTier} className="rounded-lg border border-blue-500/30 px-2.5 py-1 text-blue-400"><Plus className="inline w-3 h-3" /> Add class</button></div>
        <div className="hidden gap-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_1fr_0.8fr_0.9fr_0.9fr_auto]"><span>Min Weight (lbs.)</span><span>Max Weight (lbs.)</span><span>Hourly Rate ($/hr)</span><span>Drive Buffer (%)</span><span>Load / Unload (min.)</span><span>Delete</span></div>
        {(formData.client_portal?.weight_tiers || []).map((tier, index) => <div key={tier.id || index} className="grid gap-2 rounded-lg border border-slate-800 bg-[#121824] p-2.5 sm:grid-cols-[1fr_1fr_0.8fr_0.9fr_0.9fr_auto]">
          <input type="number" value={tier.minWeight} onChange={(e) => updateClientPortalTier(index, 'minWeight', e.target.value)} placeholder="Min lbs" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" value={tier.maxWeight} onChange={(e) => updateClientPortalTier(index, 'maxWeight', e.target.value)} placeholder="Max lbs" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" value={tier.rate} onChange={(e) => updateClientPortalTier(index, 'rate', e.target.value)} placeholder="$/hr" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" value={tier.drive_time_buffer ?? 10} onChange={(e) => updateClientPortalTier(index, 'drive_time_buffer', e.target.value)} placeholder="Drive %" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" value={tier.load_unload_base_mins ?? 30} onChange={(e) => updateClientPortalTier(index, 'load_unload_base_mins', e.target.value)} placeholder="Load mins" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <button type="button" onClick={() => removeClientPortalTier(index)} className="rounded border border-red-500/30 px-2 text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>)}
      </div>

      <div className="bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
        <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-blue-400" /> Time & Calculation Defaults
        </h4>
        <div className="grid grid-cols-1 gap-3">
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
              <option value={50}>Nearest $50</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
        <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
          <Percent className="w-4 h-4 text-amber-400" /> Standard Multipliers
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {renderSurchargeControl('after_hours_multiplier', 'After Hours', 25)}
          {renderSurchargeControl('road_club_multiplier', 'Road Club', 15)}
          {renderSurchargeControl('metro_multiplier', 'Metro', 28.57)}
          {renderSurchargeControl('hazard_multiplier', 'Hazard', 40)}
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
              <button type="button" onClick={() => removeCustomSurcharge(item.id)} className="ml-auto rounded-lg border border-red-500/30 px-2.5 py-1.5 text-red-300 hover:bg-red-500/10">Delete</button>
            </div>
          ))}
        </div>
      </div>

      <div className="-order-2 bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-bold text-slate-200 text-xs">Truck & Equipment Classes ($/hr)</h4>
            <p className="text-[10px] text-slate-400">Standard is the calculator default; additional rows are selectable classes.</p>
          </div>
          <button
            type="button"
            onClick={addTruckClass}
            className="flex items-center gap-1 text-[11px] bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/30 transition cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Class
          </button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#121824] p-2.5 rounded-lg border border-emerald-500/30">
          <div className="flex-1 text-xs font-semibold text-emerald-300">Standard Tow / Flatbed <span className="block text-[10px] font-normal text-slate-400">Default calculator class</span></div>
          <div className="flex items-center gap-1"><span className="text-[10px] text-slate-400">Min $/hr:</span><input type="number" value={formData.pricing?.hourly_min ?? 125} onChange={(e) => updatePricing('hourly_min', parseFloat(e.target.value) || 0)} className="w-20 bg-[#080c14] border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono" /></div>
          <div className="flex items-center gap-1"><span className="text-[10px] text-slate-400">Max $/hr:</span><input type="number" value={formData.pricing?.hourly_max ?? 135} onChange={(e) => updatePricing('hourly_max', parseFloat(e.target.value) || 0)} className="w-20 bg-[#080c14] border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono" /></div>
          <div className="flex items-center gap-1"><span className="text-[10px] text-slate-400">Drive buffer %:</span><input type="number" value={formData.pricing?.drive_time_buffer ?? 10} onChange={(e) => updatePricing('drive_time_buffer', parseFloat(e.target.value) || 0)} className="w-16 bg-[#080c14] border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono" /></div>
          <div className="flex items-center gap-1"><span className="text-[10px] text-slate-400">Load mins:</span><input type="number" value={formData.pricing?.load_unload_base_mins ?? 30} onChange={(e) => updatePricing('load_unload_base_mins', parseInt(e.target.value, 10) || 0)} className="w-16 bg-[#080c14] border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono" /></div>
          <span className="w-6 text-center text-[10px] text-slate-600">Default</span>
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
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Drive buffer %:</span>
                <input
                  type="number"
                  step="1"
                  value={tc.drive_time_buffer ?? 10}
                  onChange={(e) => {
                    const updated = [...formData.pricing.custom_truck_classes];
                    updated[idx].drive_time_buffer = parseFloat(e.target.value) || 0;
                    updatePricing('custom_truck_classes', updated);
                  }}
                  className="w-16 bg-[#080c14] border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Load mins:</span>
                <input
                  type="number"
                  value={tc.load_unload_base_mins ?? 30}
                  onChange={(e) => {
                    const updated = [...formData.pricing.custom_truck_classes];
                    updated[idx].load_unload_base_mins = parseInt(e.target.value, 10) || 0;
                    updatePricing('custom_truck_classes', updated);
                  }}
                  className="w-16 bg-[#080c14] border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
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
