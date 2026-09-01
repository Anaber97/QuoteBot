// src/components/SurchargeToggles.jsx
import React from 'react';

export default function SurchargeToggles({ state, dispatch, companyRates = {} }) {
  const { isMetro, isHazard } = state;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {(companyRates.pricing?.custom_surcharges || []).filter((item) => item.active !== false).map((item) => {
        const inputId = `custom-surcharge-${item.id}`;
        const checked = state.pendingCustomSurcharges?.[item.id] === true;
        return <div key={item.id} className="flex items-center gap-3 bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5">
          <input type="checkbox" id={inputId} checked={checked} onChange={() => dispatch({ type: 'SET_PENDING_CUSTOM_SURCHARGES', payload: { ...(state.pendingCustomSurcharges || {}), [item.id]: !checked } })} className="w-4 h-4 accent-blue-500" />
          <label htmlFor={inputId} className="text-xs font-medium text-slate-200 cursor-pointer flex-1">{item.name} ({item.feeType === 'percent' ? `${item.value}%` : `$${item.value}`})</label>
        </div>;
      })}

      {/* Metro Zone */}
      <div className="flex items-center gap-3 bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer select-none hover:border-slate-700 transition">
        <input
          type="checkbox"
          id="metro"
          checked={isMetro}
          onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isMetro' })}
          className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
        />
        <label htmlFor="metro" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
          Metro Traffic (+28.57%)
        </label>
      </div>

      {/* Hazard Zone */}
      <div className="flex items-center gap-3 bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer select-none hover:border-slate-700 transition">
        <input
          type="checkbox"
          id="hazard"
          checked={isHazard}
          onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isHazard' })}
          className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
        />
        <label htmlFor="hazard" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
          Hazard Zone (+40%)
        </label>
      </div>
    </div>
  );
}
