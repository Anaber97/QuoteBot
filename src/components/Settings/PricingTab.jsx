import React from 'react';
import { ArrowDown, ArrowUp, DollarSign, Clock, Plus, Trash2 } from 'lucide-react';

export default function PricingTab({
  formData,
  updatePricing,
  updatePricingMode,
  addTruckClass,
  removeTruckClass,
  reorderTruckClass,
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
  const pricingMode = formData.pricing?.pricing_mode === 'mileage' ? 'mileage' : 'hourly';
  const isMileageMode = pricingMode === 'mileage';
  const rateUnit = isMileageMode ? '$/mi' : '$/hr';
  const rateField = isMileageMode ? 'mileage_rate' : 'hourly_rate';
  const legacyMinField = isMileageMode ? 'mileage_min' : 'hourly_min';
  const legacyMaxField = isMileageMode ? 'mileage_max' : 'hourly_max';
  const classTableColumns = isMileageMode
    ? 'sm:grid-cols-[minmax(12rem,1fr)_8rem_6.75rem]'
    : 'sm:grid-cols-[minmax(12rem,1fr)_7.5rem_8rem_6.5rem_6.75rem]';
  const updateTruckClass = (index, patch) => {
    updatePricing('custom_truck_classes', formData.pricing.custom_truck_classes.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    ));
  };
  const updateStandardRate = (value) => {
    const rate = parseFloat(value) || 0;
    updatePricing(rateField, rate);
    updatePricing(legacyMinField, rate);
    updatePricing(legacyMaxField, rate);
  };
  const systemSurcharges = [
    { field: 'metro_multiplier', label: 'Metro', defaultValue: 28.57, trigger: 'Automatic · Metro Zone' },
    { field: 'hazard_multiplier', label: 'Hazard', defaultValue: 40, trigger: 'Automatic · Hazard Zone' },
  ].filter((item) => item.label.toLowerCase().includes(customSurchargeSearch.toLowerCase()));

  return (
    <div className="flex flex-col gap-5 text-xs">
      <div className="-order-3 bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
        <div>
          <h4 className="font-bold text-slate-200 text-xs">Pricing Mode</h4>
          <p className="text-[10px] text-slate-400">Choose whether standard quotes are based on billable time or total routed mileage.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#121824] p-1 border border-slate-800">
          {['hourly', 'mileage'].map((mode) => (
            <button key={mode} type="button" onClick={() => updatePricing('pricing_mode', mode)} className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${pricingMode === mode ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
              {mode === 'hourly' ? 'Hourly Mode' : 'Mileage Mode'}
            </button>
          ))}
        </div>
      </div>
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
        <div className="flex items-center justify-between"><div><h4 className="font-bold text-slate-200 text-xs">Equipment Weight Pricing</h4><p className="text-[10px] text-slate-400">Used by the Equipment Calculator with the selected pricing mode.</p></div><button type="button" onClick={addClientPortalTier} className="rounded-lg border border-blue-500/30 px-2.5 py-1 text-blue-400"><Plus className="inline w-3 h-3" /> Add class</button></div>
        <div className="hidden gap-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.9fr_0.9fr_auto]"><span>Min Weight (lbs.)</span><span>Max Weight (lbs.)</span><span>Rate ({rateUnit})</span><span>Permit ($)</span><span>Drive Buffer (%)</span><span>Load / Unload (min.)</span><span>Delete</span></div>
        {(formData.client_portal?.weight_tiers || []).map((tier, index) => <div key={tier.id || index} className="grid gap-2 rounded-lg border border-slate-800 bg-[#121824] p-2.5 sm:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.9fr_0.9fr_auto]">
          <input type="number" value={tier.minWeight} onChange={(e) => updateClientPortalTier(index, 'minWeight', e.target.value)} placeholder="Min lbs" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" value={tier.maxWeight} onChange={(e) => updateClientPortalTier(index, 'maxWeight', e.target.value)} placeholder="Max lbs" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" step={isMileageMode ? '0.01' : '1'} value={isMileageMode ? (tier.mileageRate ?? 5) : (tier.hourlyRate ?? tier.rate)} onChange={(e) => updateClientPortalTier(index, isMileageMode ? 'mileageRate' : 'hourlyRate', e.target.value)} placeholder={rateUnit} className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" min="0" step="1" value={tier.permitCost ?? 150} onChange={(e) => updateClientPortalTier(index, 'permitCost', e.target.value)} placeholder="Permit $" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" value={tier.drive_time_buffer ?? 10} onChange={(e) => updateClientPortalTier(index, 'drive_time_buffer', e.target.value)} placeholder="Drive %" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" value={tier.load_unload_base_mins ?? 30} onChange={(e) => updateClientPortalTier(index, 'load_unload_base_mins', e.target.value)} placeholder="Load mins" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <button type="button" onClick={() => removeClientPortalTier(index)} aria-label={`Delete equipment weight class ${index + 1}`} title="Delete class" className="inline-flex items-center justify-center rounded border border-red-500/30 px-2 py-2 text-red-300 transition hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
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
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-bold text-slate-200 text-xs">Surcharges</h4>
            <p className="text-[10px] text-slate-400">Automatic rules and optional fees—including hook-up and fuel charges—in one table.</p>
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
        <div className="hidden grid-cols-[minmax(10rem,1fr)_8rem_7rem_minmax(10rem,1fr)_5rem] gap-2 px-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
          <span>Surcharge</span><span>Type</span><span>Amount</span><span>Applied</span><span>Action</span>
        </div>
        <div className="space-y-2">
          {customSurchargeFilter !== 'inactive' && systemSurcharges.map((item) => {
            const feeType = formData.pricing?.surchargeModes?.[item.field] || 'percent';
            return <div key={item.field} className="grid gap-2 rounded-lg border border-amber-500/20 bg-[#121824] p-2.5 sm:grid-cols-[minmax(10rem,1fr)_8rem_7rem_minmax(10rem,1fr)_5rem] sm:items-center">
              <div><span className="font-semibold text-slate-200">{item.label}</span></div>
              <select value={feeType} onChange={(e) => updatePricingMode(item.field, e.target.value)} className="bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs"><option value="flat">Flat $</option><option value="percent">Percent %</option></select>
              <input type="number" value={formData.pricing?.[item.field] ?? item.defaultValue} onChange={(e) => updatePricing(item.field, parseFloat(e.target.value) || 0)} className="w-full bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs font-mono" />
              <span className="text-[10px] text-slate-400">{item.trigger}</span>
              <span className="w-full text-center text-[10px] text-slate-600">Locked</span>
            </div>;
          })}
          {customSurchargeItems.map((item) => (
            <div key={item.id} className="grid gap-2 rounded-lg border border-slate-800 bg-[#121824] p-2.5 sm:grid-cols-[minmax(10rem,1fr)_8rem_7rem_minmax(10rem,1fr)_5rem] sm:items-center">
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateCustomSurcharge(item.id, 'name', e.target.value)}
                className="flex-1 bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs"
              />
              <select
                value={item.feeType || 'flat'}
                onChange={(e) => updateCustomSurcharge(item.id, 'feeType', e.target.value)}
                className="bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs"
              >
                <option value="flat">Flat</option>
                <option value="percent">Percent</option>
              </select>
              <input
                type="number"
                value={item.value ?? 0}
                onChange={(e) => updateCustomSurcharge(item.id, 'value', e.target.value)}
                className="w-full bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs font-mono"
              />
              <button type="button" onClick={() => toggleCustomSurcharge(item.id)} data-enabled={item.active !== false} className={`surcharge-status inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${item.active !== false ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15' : 'border-slate-600 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:text-slate-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${item.active !== false ? 'bg-emerald-400' : 'bg-slate-500'}`} />{item.active !== false ? 'Enabled' : 'Disabled'}</button>
              <button type="button" onClick={() => removeCustomSurcharge(item.id)} aria-label={`Delete ${item.name}`} title="Delete surcharge" className="inline-flex items-center justify-center rounded border border-red-500/30 px-2 py-2 text-red-300 transition hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="-order-2 bg-[#080c14] p-3.5 rounded-xl border border-slate-800 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-bold text-slate-200 text-xs">Truck & Equipment Classes ({rateUnit})</h4>
            <p className="text-[10px] text-slate-400">{isMileageMode ? 'Mileage quotes use only the routed miles and per-mile class rates.' : 'Standard is the calculator default; additional rows are selectable classes.'}</p>
          </div>
          <button
            type="button"
            onClick={addTruckClass}
            className="flex items-center gap-1 text-[11px] bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/30 transition cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Class
          </button>
        </div>
        <div className={`grid gap-2 bg-[#121824] p-2.5 rounded-lg border border-emerald-500/30 sm:items-end ${classTableColumns}`}>
          <div className="flex-1 text-xs font-semibold text-emerald-300">Standard Tow / Flatbed <span className="block text-[10px] font-normal text-slate-400">Default calculator class</span></div>
          <label className="text-[10px] text-slate-400">Rate {rateUnit}<input type="number" step={isMileageMode ? '0.01' : '1'} value={formData.pricing?.[rateField] ?? (isMileageMode ? 5 : 125)} onChange={(e) => updateStandardRate(e.target.value)} className="mt-1 w-full bg-[#080c14] border border-slate-700 rounded px-2 py-1.5 text-white text-xs font-mono" /></label>
          {!isMileageMode && <label className="text-[10px] text-slate-400">Drive buffer %<input type="number" value={formData.pricing?.drive_time_buffer ?? 10} onChange={(e) => updatePricing('drive_time_buffer', parseFloat(e.target.value) || 0)} className="mt-1 w-full bg-[#080c14] border border-slate-700 rounded px-2 py-1.5 text-white text-xs font-mono" /></label>}
          {!isMileageMode && <label className="text-[10px] text-slate-400">Load mins<input type="number" value={formData.pricing?.load_unload_base_mins ?? 30} onChange={(e) => updatePricing('load_unload_base_mins', parseInt(e.target.value, 10) || 0)} className="mt-1 w-full bg-[#080c14] border border-slate-700 rounded px-2 py-1.5 text-white text-xs font-mono" /></label>}
          <span className="pb-2 text-center text-[9px] uppercase tracking-wide text-slate-600">Default</span>
        </div>
        {formData.pricing?.custom_truck_classes?.map((tc, idx) => (
          <div key={tc.id} className={`grid gap-2 bg-[#121824] p-2.5 rounded-lg border border-slate-800 sm:items-end ${classTableColumns}`}>
            <input
              type="text"
              placeholder="Class Name"
              value={tc.name}
              onChange={(e) => updateTruckClass(idx, { name: e.target.value })}
              className="w-full bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs"
            />
              <label className="text-[10px] text-slate-400">Rate {rateUnit}
                <input
                  type="number"
                  value={isMileageMode ? (tc.mileageRate ?? tc.minMileageRate ?? 5) : (tc.hourlyRate ?? tc.rate ?? tc.minRate)}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value) || 0;
                    updateTruckClass(idx, isMileageMode
                      ? { mileageRate: rate, minMileageRate: rate, maxMileageRate: rate }
                      : { hourlyRate: rate, rate, minRate: rate, maxRate: rate });
                  }}
                  className="mt-1 w-full bg-[#080c14] border border-slate-700 rounded px-2 py-1.5 text-white text-xs font-mono"
                />
              </label>
              {!isMileageMode && <label className="text-[10px] text-slate-400">Drive buffer %
                <input
                  type="number"
                  step="1"
                  value={tc.drive_time_buffer ?? 10}
                  onChange={(e) => updateTruckClass(idx, { drive_time_buffer: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full bg-[#080c14] border border-slate-700 rounded px-2 py-1.5 text-white text-xs font-mono"
                />
              </label>}
              {!isMileageMode && <label className="text-[10px] text-slate-400">Load mins
                <input
                  type="number"
                  value={tc.load_unload_base_mins ?? 30}
                  onChange={(e) => updateTruckClass(idx, { load_unload_base_mins: parseInt(e.target.value, 10) || 0 })}
                  className="mt-1 w-full bg-[#080c14] border border-slate-700 rounded px-2 py-1.5 text-white text-xs font-mono"
                />
              </label>}
              <div className="flex items-center justify-end gap-1">
                <button type="button" disabled={idx === 0} onClick={() => reorderTruckClass(idx, -1)} aria-label={`Move ${tc.name} up`} title="Move class up" className="inline-flex items-center justify-center rounded border border-slate-700 px-2 py-2 text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={idx === formData.pricing.custom_truck_classes.length - 1} onClick={() => reorderTruckClass(idx, 1)} aria-label={`Move ${tc.name} down`} title="Move class down" className="inline-flex items-center justify-center rounded border border-slate-700 px-2 py-2 text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => removeTruckClass(tc.id)} aria-label={`Delete ${tc.name}`} title="Delete class" className="inline-flex items-center justify-center rounded border border-red-500/30 px-2 py-2 text-red-300 transition hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
          </div>
        ))}
      </div>
    </div>
  );
}
