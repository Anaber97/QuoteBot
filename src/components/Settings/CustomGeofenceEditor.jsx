import React, { useEffect, useRef, useState } from 'react';
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
  const mapElementRef = useRef(null);
  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const vertexMarkersRef = useRef([]);
  const zoneRef = useRef(zone);
  const onChangeRef = useRef(onChange);
  zoneRef.current = zone;
  onChangeRef.current = onChange;
  const [status, setStatus] = useState('Search for a city or municipality to define this geofence.');
  const reviewQuery = buildReviewQuery(zone);
  const reviewMapUrl = API_KEY && reviewQuery
    ? `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${encodeURIComponent(reviewQuery)}`
    : null;

  useEffect(() => {
    if (!zoneRef.current) return;

    let cancelled = false;
    let placeListener = null;
    let mapClickListener = null;

    const bootstrap = async () => {
      try {
        if (!API_KEY) {
          setStatus('Missing VITE_GOOGLE_MAPS_API_KEY. Add it to your .env file and restart Vite.');
          return;
        }

        await loadGoogleMaps({ requirePlaces: true, requireDistanceMatrix: false, requireDrawing: false });
        if (cancelled || !searchInputRef.current || !mapElementRef.current || !window.google?.maps?.places) return;

        const google = window.google;
        const existingShape = Array.isArray(zoneRef.current?.shape) ? zoneRef.current.shape : [];
        const map = new google.maps.Map(mapElementRef.current, {
          center: existingShape[0] || { lat: 39.5, lng: -98.35 },
          zoom: existingShape.length ? 11 : 4,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        polygonRef.current = new google.maps.Polygon({
          map,
          paths: existingShape,
          strokeColor: '#22d3ee',
          strokeOpacity: 0.95,
          strokeWeight: 3,
          fillColor: '#22d3ee',
          fillOpacity: 0.16,
          clickable: false,
        });
        if (existingShape.length >= 3) {
          const bounds = new google.maps.LatLngBounds();
          existingShape.forEach((point) => bounds.extend(point));
          map.fitBounds(bounds, 28);
        }

        mapClickListener = map.addListener('click', (event) => {
          if (!event.latLng) return;
          const currentShape = Array.isArray(zoneRef.current?.shape) ? zoneRef.current.shape : [];
          const nextShape = [...currentShape, { lat: event.latLng.lat(), lng: event.latLng.lng() }];
          onChangeRef.current('shape', nextShape);
          setStatus(`${nextShape.length} boundary point${nextShape.length === 1 ? '' : 's'} selected. ${nextShape.length < 3 ? 'Add at least three.' : 'The boundary is ready to save.'}`);
        });

        const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
          fields: ['address_components', 'formatted_address', 'name', 'place_id', 'geometry'],
          types: ['(cities)'],
        });
        autocompleteRef.current = autocomplete;

        placeListener = autocomplete.addListener('place_changed', () => {
          const currentZone = zoneRef.current;
          const place = autocomplete.getPlace();
          const components = Array.isArray(place?.address_components) ? place.address_components : [];
          const cityComponent = components.find((component) => component.types.includes('locality'))
            || components.find((component) => component.types.includes('administrative_area_level_3'))
            || components.find((component) => component.types.includes('sublocality'));
          const stateComponent = components.find((component) => component.types.includes('administrative_area_level_1'));

          const nextCity = toTitleCase(cityComponent?.long_name || place?.name || '');
          const nextState = String(stateComponent?.short_name || stateComponent?.long_name || '').trim().toUpperCase();
          const nextQuery = [nextCity, nextState].filter(Boolean).join(', ');

          onChangeRef.current('city', nextCity);
          onChangeRef.current('state', nextState);
          onChangeRef.current('localityQuery', nextQuery);
          if (!currentZone?.name || currentZone.name === 'New Municipality Zone') {
            onChangeRef.current('name', nextQuery || nextCity || currentZone?.name || 'Custom Geofence');
          }
          if (place?.geometry?.viewport) map.fitBounds(place.geometry.viewport);
          else if (place?.geometry?.location) {
            map.setCenter(place.geometry.location);
            map.setZoom(11);
          }
          setStatus(nextQuery ? `Selected ${nextQuery}.` : 'Select a city from the suggestions.');
        });

        const currentZone = zoneRef.current;
        if (currentZone?.localityQuery && searchInputRef.current.value !== currentZone.localityQuery) {
          searchInputRef.current.value = currentZone.localityQuery;
        } else if (currentZone?.city && searchInputRef.current.value !== buildReviewQuery(currentZone)) {
          searchInputRef.current.value = buildReviewQuery(currentZone);
        }

        const currentReviewQuery = buildReviewQuery(zoneRef.current);
        setStatus(currentReviewQuery ? `Reviewing ${currentReviewQuery}.` : 'Search for a city or municipality to define this geofence.');

      } catch (error) {
        console.warn('Google Places autocomplete unavailable:', error);
        setStatus(error instanceof Error ? error.message : 'Google Places autocomplete failed to load.');
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
      if (placeListener) placeListener.remove();
      if (mapClickListener) mapClickListener.remove();
      if (polygonRef.current) polygonRef.current.setMap(null);
      vertexMarkersRef.current.forEach((marker) => marker.setMap(null));
      vertexMarkersRef.current = [];
      autocompleteRef.current = null;
      polygonRef.current = null;
      mapRef.current = null;
    };
  }, [zone?.id]);

  useEffect(() => {
    if (!polygonRef.current) return;
    const shape = Array.isArray(zone?.shape) ? zone.shape : [];
    polygonRef.current.setPath(shape);
    vertexMarkersRef.current.forEach((marker) => marker.setMap(null));
    vertexMarkersRef.current = [];
    if (!mapRef.current || !window.google?.maps) return;
    vertexMarkersRef.current = shape.map((point) => new window.google.maps.Marker({
      position: point,
      map: mapRef.current,
      clickable: false,
      zIndex: 10,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: '#22d3ee',
        fillOpacity: 1,
        strokeColor: '#0f172a',
        strokeWeight: 2,
      },
    }));
  }, [zone?.shape]);

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
        <p className="mt-1 text-[10px] text-slate-500">City and state identify the zone; the boundary drawn below decides whether pricing applies.</p>
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
          <button type="button" onClick={() => onChange('surchargeFeeType', zone.surchargeFeeType === 'flat' ? 'percent' : 'flat')} className="light-surcharge-type-toggle rounded-full border border-slate-700 px-3 py-1.5 text-[10px] font-semibold text-slate-200">
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

      <div className={`grid grid-cols-1 gap-3 ${reviewMapUrl ? 'lg:grid-cols-2' : ''}`}>
        {reviewMapUrl && (
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-semibold text-slate-300">Google municipality reference</p>
              <p className="text-[10px] text-slate-500">Use Google&apos;s displayed municipal outline as the visual guide.</p>
            </div>
            <iframe
              title={`Google boundary reference for ${reviewQuery}`}
              src={reviewMapUrl}
              width="100%"
              height="288"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              className="rounded-lg border border-slate-700 bg-[#080c14]"
            />
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold text-slate-300">TowCalc pricing boundary</p>
              <p className="text-[10px] text-slate-500">Click matching points in order. The last point connects back to the first.</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button type="button" disabled={!zone.shape?.length} onClick={() => onChange('shape', zone.shape.slice(0, -1))} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-40">Undo</button>
              <button type="button" disabled={!zone.shape?.length} onClick={() => onChange('shape', [])} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-40">Clear</button>
            </div>
          </div>
          <div ref={mapElementRef} role="application" aria-label="Draw city-limit boundary" className="h-72 overflow-hidden rounded-lg border border-slate-700 bg-[#080c14]" />
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#0b1220] p-2.5 text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5 text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>{status}</span>
        </div>
      </div>

      {Array.isArray(zone.shape) && zone.shape.length >= 3 ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[10px] text-emerald-200">
          {zone.shape.length} boundary points selected. Quotes will use this polygon, not the city name in the address.
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[10px] text-amber-200">
          This zone is inactive until at least three boundary points are drawn and saved.
        </div>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={!String(zone.city || '').trim() || !String(zone.state || '').trim() || !Array.isArray(zone.shape) || zone.shape.length < 3}
        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        Apply geofence changes
      </button>
    </div>
  );
}
