// src/components/WaypointList.jsx
import React from 'react';

const WaypointInput = React.memo(({ index, totalWaypoints, value, onChange, onRemove, inputRef }) => {
  const isPickUp = index === 0;
  const isDropOff = index === totalWaypoints - 1;
  const isWaypoint = !isPickUp && !isDropOff;
  const label = isPickUp ? 'Pick-up Location' : isDropOff ? 'Drop-off Location' : `Stop ${index} (Waypoint)`;

  return (
    <div className="w-full">
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2 w-full">
        <input
          ref={inputRef}
          type="text"
          placeholder={`Enter ${label.toLowerCase()}...`}
          value={value}
          onChange={(e) => onChange(index, e.target.value)}
          className="w-full flex-1 bg-[#080c14] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none text-sm shadow-inner"
        />
        {isWaypoint && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove waypoint ${index}`}
            className="bg-red-950/40 hover:bg-red-900/50 text-red-400 w-11 h-11 shrink-0 rounded-xl border border-red-800/50 font-bold text-lg flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
});

export default function WaypointList({ waypoints, inputRefs, onChange, onRemove, onAdd }) {
  return (
    <div className="space-y-3">
      {waypoints.map((waypoint, index) => (
        <WaypointInput
          key={index}
          index={index}
          totalWaypoints={waypoints.length}
          value={waypoint}
          onChange={onChange}
          onRemove={onRemove}
          inputRef={(el) => (inputRefs.current[index] = el)}
        />
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="w-full py-2 bg-slate-800/60 hover:bg-slate-800 text-blue-400 font-semibold text-xs rounded-xl border border-blue-500/30 transition cursor-pointer"
      >
        + Add Extra Stop
      </button>
    </div>
  );
}