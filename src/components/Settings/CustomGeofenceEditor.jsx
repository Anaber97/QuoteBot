import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import { loadGoogleMaps } from '../../lib/googleMaps';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const toTitleCase = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildReviewQuery = (zone) => {
  const city = String(zone?.city || '').trim();
  const state = String(zone?.state || '').trim();
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (zone?.localityQuery) return zone.localityQuery;
  return '';
};

export default function CustomGeofenceEditor({ zone, onChange, onSave, onDelete }) {
  const searchInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [status, setStatus] = useState('Search for a city or municipality to define this geofence.');

  const reviewQuery = useMemo(() => buildReviewQuery(zone), [zone?.city, zone?.state, zone?.localityQuery]);
  const reviewMapUrl = useMemo(() => {
    if (!API_KEY || !reviewQuery) return null;
    return `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${encodeURIComponent(reviewQuery)}`;
  }, [reviewQuery]);

  useEffect(() => {
    if (!zone) return;

    let cancelled = false;

    const bootstrap = async () => {
      try {
        if (!API_KEY) {
          setStatus('Missing VITE_GOOGLE_MAPS_API_KEY. Add it to your .env file and restart Vite.');
          return;
        }

        await loadGoogleMaps({ requirePlaces: true, requireDistanceMatrix: false, requireDrawing: false });
        if (cancelled || !searchInputRef.current || !window.google?.maps?.places) return;

        const google = window.google;
        const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
          fields: ['address_components', 'formatted_address', 'name', 'place_id', 'geometry'],
          types: ['(cities)'],
        });
        autocompleteRef.current = autocomplete;

        const listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const components = Array.isArray(place?.address_components) ? place.address_components : [];
          const cityComponent = components.find((component) => component.types.includes('locality'))
            || components.find((component) => component.types.includes('administrative_area_level_3'))
            || components.find((component) => component.types.includes('sublocality'));
          const stateComponent = components.find((component) => component.types.includes('administrative_area_level_1'));

          const nextCity = toTitleCase(cityComponent?.long_name || place?.name || '');
          const nextState = String(stateComponent?.short_name || stateComponent?.long_name || '').trim().toUpperCase();
          const nextQuery = [nextCity, nextState].filter(Boolean).join(', ');

          onChange('city', nextCity);
          onChange('state', nextState);
          onChange('localityQuery', nextQuery);
          if (!zone?.name || zone.name === 'New Municipality Zone') {
            onChange('name', nextQuery || nextCity || zone.name || 'Custom Geofence');
          }
          setStatus(nextQuery ? `Selected ${nextQuery}.` : 'Select a city from the suggestions.');
        });

        if (zone?.localityQuery && searchInputRef.current.value !== zone.localityQuery) {
          searchInputRef.current.value = zone.localityQuery;
        } else if (zone?.city && searchInputRef.current.value !== buildReviewQuery(zone)) {
          searchInputRef.current.value = buildReviewQuery(zone);
        }

        setStatus(reviewQuery ? `Reviewing ${reviewQuery}.` : 'Search for a city or municipality to define this geofence.');

        return () => {
          google.maps.event.removeListener(listener);
        };
      } catch (error) {
        console.warn('Google Places autocomplete unavailable:', error);
        setStatus(error instanceof Error ? error.message : 'Google Places autocomplete failed to load.');
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
      autocompleteRef.current = null;
    };
  }, [zone?.id]);

  useEffect(() => {
    if (!zone) return;
    setStatus(reviewQuery ? `Reviewing ${reviewQuery}.` : 'Search for a city or municipality to define this geofence.');
  }, [reviewQuery, zone?.id]);

  if (!zone) return null;

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-[#121824] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Custom geofence</p>
          <p className="font-semibold text-white">{zone.name || 'New municipality zone'}</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] text-slate-300"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-slate-400">Search locality</label>
        <input
          ref={searchInputRef}
          type="text"
          defaultValue={buildReviewQuery(zone)}
          placeholder="Start typing a city or municipality"
          className="w-full rounded border border-slate-700 bg-[#080c14] p-2 text-white"
        />
        <p className="mt-1 text-[10px] text-slate-500">Pick a city from Google suggestions. The selected locality is what the quote engine will use.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">Area label</label>
          <input
            type="text"
            value={zone.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Example: Henderson, TX"
            className="w-full rounded border border-slate-700 bg-[#080c14] p-2 text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">Price mode</label>
          <select
            value={zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge')}
            onChange={(e) => onChange('pricingMode', e.target.value)}
            className="w-full rounded border border-slate-700 bg-[#080c14] p-2 text-white"
          >
            <option value="surcharge">Surcharge</option>
            <option value="flat_rate">Flat rate ($)</option>
          </select>
        </div>
      </div>

      {(zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge')) === 'surcharge' && (
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">Surcharge (%/$)</label>
          <button type="button" onClick={() => onChange('surchargeFeeType', zone.surchargeFeeType === 'flat' ? 'percent' : 'flat')} className="rounded-full border border-slate-700 px-3 py-1.5 text-[10px] font-semibold text-slate-200">
            {zone.surchargeFeeType === 'flat' ? 'Dollar amount ($)' : 'Percent (%)'}
          </button>
        </div>
      )}

      <div>
        <label className="mb-1 block text-[10px] text-slate-400">Charge value</label>
        <input
          type="number"
          value={zone.price ?? ''}
          onChange={(e) => onChange('price', e.target.value)}
          placeholder={(zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge')) === 'flat_rate' || zone.surchargeFeeType === 'flat' ? '75' : '25'}
          className="w-full rounded border border-slate-700 bg-[#080c14] p-2 text-white font-mono"
        />
        <p className="mt-1 text-[10px] text-slate-500">Flat rate prices contained trips. Surcharge adds either a percentage or dollar amount to applicable trips.</p>
      </div>

      <div className="rounded-lg border border-slate-700 bg-[#080c14] overflow-hidden">
        {reviewMapUrl ? (
          <iframe
            title="Locality review map"
            width="100%"
            height="224"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={reviewMapUrl}
          />
        ) : (
          <div className="flex h-56 items-center justify-center px-4 text-center text-[10px] text-slate-500">
            {reviewQuery ? `Map preview unavailable for ${reviewQuery}.` : 'Select a locality to review it on the map.'}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#0b1220] p-2.5 text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5 text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>{status}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white"
      >
        Save custom geofence
      </button>
    </div>
  );
}
