// src/components/SurchargeToggles.jsx
import React from 'react';

export default function SurchargeToggles({ state, dispatch }) {
  const { isAfterHours, isRoadClub, isMetro, isHazard } = state;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {/* After Hours */}
      <div className="flex items-center gap-3 bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer select-none hover:border-slate-700 transition">
        <input
          type="checkbox"
          id="afterHours"
          checked={isAfterHours}
          onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isAfterHours' })}
          className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
        />
        <label htmlFor="afterHours" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
          After Hours (+25%)
        </label>
      </div>

      {/* Road Club */}
      <div className="flex items-center gap-3 bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer select-none hover:border-slate-700 transition">
        <input
          type="checkbox"
          id="roadClub"
          checked={isRoadClub}
          onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isRoadClub' })}
          className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
        />
        <label htmlFor="roadClub" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
          Road Club (+15%)
        </label>
      </div>

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