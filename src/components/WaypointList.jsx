// src/components/WaypointList.jsx
import React, { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';

const WaypointInput = React.memo(({ index, totalWaypoints, value, onChange, onRemove, inputRef }) => {
  const isPickUp = index === 0;
  const isDropOff = index === totalWaypoints - 1;
  const isWaypoint = !isPickUp && !isDropOff;
  const label = isPickUp ? 'Pickup' : isDropOff ? 'Drop-off (optional)' : `Stop ${index}`;

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
    <li className="relative flex gap-3">
      <span aria-hidden="true" className={`relative z-10 mt-[13px] h-3.5 w-3.5 shrink-0 rounded-full border-2 ${isPickUp || isDropOff ? 'border-accent bg-accent' : 'border-slate-500 bg-canvas'}`} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          aria-label={label}
          ref={setRef}
          type="text"
          placeholder={isPickUp ? 'Pickup: business, address or city' : isDropOff ? 'Drop-off: business, address or city' : 'Extra stop address'}
          value={value}
          onChange={(e) => onChange(index, e.target.value)}
          className="min-h-11 w-full flex-1 rounded-lg border border-slate-800 bg-canvas px-3.5 text-[15px] text-white placeholder-slate-500 focus:border-accent focus:outline-none"
        />
        {isWaypoint && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove waypoint ${index}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
});

export default function WaypointList({ waypoints, inputRefs, onChange, onRemove, onAdd, onReset, yardName = 'Yard' }) {
  const yardRow = (text) => (
    <li className="relative flex items-center gap-3 py-1 text-sm text-slate-400">
      <span aria-hidden="true" className="relative z-10 h-3.5 w-3.5 shrink-0 rounded-sm bg-slate-600" />
      {text}
    </li>
  );
  return (
    <div className="space-y-3">
      <ol className="relative m-0 list-none space-y-2 p-0" aria-label="Route stops">
        <span aria-hidden="true" className="absolute bottom-3 left-[6px] top-3 w-0.5 bg-slate-800" />
        {yardRow(`From ${yardName}`)}
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
        {yardRow(`Back to ${yardName}`)}
      </ol>
      <div className="flex items-center gap-4 pl-[26px]">
        <button type="button" onClick={onAdd} className="text-sm font-semibold text-accent-text hover:underline cursor-pointer">
          + Add stop
        </button>
        <button type="button" onClick={onReset} className="text-sm font-semibold text-slate-400 hover:text-slate-200 cursor-pointer">
          Clear route
        </button>
      </div>
    </div>
  );
}
