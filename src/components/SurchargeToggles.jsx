import { resolveZoneCharge, formatZoneCharge } from '../../shared/pricing/zoneCharge.js';
// src/components/SurchargeToggles.jsx
import React from 'react';

const Chip = ({ id, checked, onChange, children }) => (
  <label htmlFor={id} className={`inline-flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
    checked ? 'border-accent/40 bg-accent/10 text-accent-text' : 'border-slate-800 text-slate-300 hover:border-slate-700'
  }`}>
    <input type="checkbox" id={id} checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--tc-accent)]" />
    {children}
  </label>
);

export default function SurchargeToggles({ state, dispatch, companyRates = {} }) {
  const { isMetro, isHazard } = state;

  return (
    <div className="flex flex-wrap gap-2">
      {(companyRates.pricing?.custom_surcharges || []).filter((item) => item.active !== false).map((item) => {
        const checked = state.pendingCustomSurcharges?.[item.id] === true;
        return (
          <Chip key={item.id} id={`custom-surcharge-${item.id}`} checked={checked}
            onChange={() => dispatch({ type: 'SET_PENDING_CUSTOM_SURCHARGES', payload: { ...(state.pendingCustomSurcharges || {}), [item.id]: !checked } })}>
            {item.name} <span className="font-normal opacity-80">{item.feeType === 'percent' ? `${item.value}%` : `$${item.value}`}</span>
          </Chip>
        );
      })}
      <Chip id="metro" checked={isMetro} onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isMetro' })}>
        Metro traffic <span className="font-normal opacity-80">{formatZoneCharge(resolveZoneCharge({ multiplier: 1.2857 }, companyRates, 'metro_multiplier'))}</span>
      </Chip>
      <Chip id="hazard" checked={isHazard} onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isHazard' })}>
        Hazard zone <span className="font-normal opacity-80">{formatZoneCharge(resolveZoneCharge({ multiplier: 1.4 }, companyRates, 'hazard_multiplier'))}</span>
      </Chip>
    </div>
  );
}
