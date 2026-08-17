// src/components/WaypointList.jsx
import React, { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';

const WaypointInput = React.memo(({ index, totalWaypoints, value, onChange, onRemove, inputRef }) => {
  const isPickUp = index === 0;
  const isDropOff = index === totalWaypoints - 1;
  const isWaypoint = !isPickUp && !isDropOff;
  const label = isPickUp ? 'Pick-up Location' : isDropOff ? 'Drop-off Location (Optional)' : `Stop ${index} (Waypoint)`;

  const internalInputRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialize Google Places Autocomplete on this input field
  useEffect(() => {
    const el = internalInputRef.current;
    if (!el || typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    const setupAutocomplete = async () => {
      try {
        await loadGoogleMaps();
        if (cancelled || !el.isConnected) {
          return;
        }

        if (!window.google?.maps?.places) {
          return;
        }

        const autocomplete = new window.google.maps.places.Autocomplete(el, {
          types: ['geocode', 'establishment'],
          componentRestrictions: { country: 'us' },
        });

        const handleKeyDown = (e) => {
          if (e.key === 'Enter' && document.querySelector('.pac-container:hover')) {
            e.preventDefault();
          }
        };
        el.addEventListener('keydown', handleKeyDown);

        const listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const formattedAddress = place.formatted_address || place.name || el.value;
          if (formattedAddress) {
            onChangeRef.current(index, formattedAddress);
          }
        });

        return () => {
          el.removeEventListener('keydown', handleKeyDown);
          if (window.google?.maps?.event && listener) {
            window.google.maps.event.removeListener(listener);
          }
        };
      } catch (error) {
        console.error('Google Maps autocomplete failed to initialize:', error);
      }
    };

    const cleanupPromise = setupAutocomplete();

    return () => {
      cancelled = true;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [index]);

  // Combine parent inputRef callback with internalInputRef
  const setRef = (element) => {
    internalInputRef.current = element;
    if (typeof inputRef === 'function') {
      inputRef(element);
    } else if (inputRef) {
      inputRef.current = element;
    }
  };

  return (
    <div className="w-full">
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2 w-full">
        <input
          ref={setRef}
          type="text"
          placeholder={isPickUp ? 'Enter pick-up location...' : isDropOff ? 'Optional — leave blank for a round-trip quote' : `Enter ${label.toLowerCase()}...`}
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

export default function WaypointList({ waypoints, inputRefs, onChange, onRemove, onAdd, onReset }) {
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="w-3/4 py-2 bg-slate-800/60 hover:bg-slate-800 text-blue-400 font-semibold text-xs rounded-xl border border-blue-500/30 transition cursor-pointer"
        >
          + Add Extra Stop
        </button>
        <button
          type="button"
          onClick={onReset}
          className="light-reset-button w-1/4 py-2 bg-slate-900/80 hover:bg-slate-900 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
        >
          RESET
        </button>
      </div>
    </div>
  );
}
