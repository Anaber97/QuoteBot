import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import { loadGoogleMaps } from '../../lib/googleMaps';
import { buildRadiusPolygon } from '../../utils/geofenceGeometry';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'b2a8bbbaef4c9498e7600aeb';
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

export default function CustomGeofenceEditor({ zone, bases = [], onChange, onSave, onDelete }) {
  const firstBaseId = bases[0]?.id || '';
  const searchInputRef = useRef(null);
  const mapElementRef = useRef(null);
  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const vertexMarkersRef = useRef([]);
  const boundaryLayerRef = useRef(null);
  const mapControlRef = useRef(null);
  const mapControlButtonsRef = useRef({ undo: null, clear: null });
  const zoneRef = useRef(zone);
  const onChangeRef = useRef(onChange);
  zoneRef.current = zone;
  onChangeRef.current = onChange;
  const [status, setStatus] = useState('Search for a city or municipality to define this geofence.');
  const [radiusMiles, setRadiusMiles] = useState(String(zone?.radiusMiles || 10));
  const [radiusSource, setRadiusSource] = useState(zone?.radiusSource || 'city');
  const [selectedBaseId, setSelectedBaseId] = useState(zone?.radiusBaseId || firstBaseId);

  useEffect(() => {
    setRadiusMiles(String(zone?.radiusMiles || 10));
    setRadiusSource(zone?.radiusSource || 'city');
    setSelectedBaseId(zone?.radiusBaseId || firstBaseId);
  }, [zone?.id, zone?.radiusMiles, zone?.radiusSource, zone?.radiusBaseId, firstBaseId]);

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
          ...(MAP_ID ? { mapId: MAP_ID } : {}),
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        const controls = document.createElement('div');
        controls.className = 'm-2 flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg';
        const makeControlButton = (label, action) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.className = 'min-h-10 px-3 text-xs font-bold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40';
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            action();
          });
          controls.appendChild(button);
          return button;
        };
        mapControlButtonsRef.current.undo = makeControlButton('Undo point', () => {
          const shape = Array.isArray(zoneRef.current?.shape) ? zoneRef.current.shape : [];
          onChangeRef.current('shape', shape.slice(0, -1));
        });
        mapControlButtonsRef.current.clear = makeControlButton('Clear', () => onChangeRef.current('shape', []));
        mapControlButtonsRef.current.undo.disabled = existingShape.length === 0;
        mapControlButtonsRef.current.clear.disabled = existingShape.length === 0;
        map.controls[google.maps.ControlPosition.TOP_LEFT].push(controls);
        mapControlRef.current = controls;

        const showGoogleBoundary = (placeId) => {
          if (!MAP_ID || !placeId || typeof map.getFeatureLayer !== 'function') return false;
          try {
            const layer = map.getFeatureLayer('LOCALITY');
            layer.style = ({ feature }) => feature.placeId === placeId ? {
              strokeColor: '#f97316',
              strokeOpacity: 1,
              strokeWeight: 3,
              fillColor: '#f97316',
              fillOpacity: 0.08,
            } : null;
            boundaryLayerRef.current = layer;
            return true;
          } catch (error) {
            console.warn('Google municipality boundary layer unavailable:', error);
            return false;
          }
        };
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
          onChangeRef.current('placeId', place?.place_id || '');
          if (place?.geometry?.location) {
            onChangeRef.current('center', { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
          }
          if (!currentZone?.name || currentZone.name === 'New Municipality Zone') {
            onChangeRef.current('name', nextQuery || nextCity || currentZone?.name || 'Custom Geofence');
          }
          if (place?.geometry?.viewport) map.fitBounds(place.geometry.viewport);
          else if (place?.geometry?.location) {
            map.setCenter(place.geometry.location);
            map.setZoom(11);
          }
          const boundaryVisible = showGoogleBoundary(place?.place_id);
          setStatus(nextQuery
            ? `Selected ${nextQuery}. ${boundaryVisible ? 'Google reference boundary is outlined in orange.' : 'Draw the pricing boundary in cyan.'}`
            : 'Select a city from the suggestions.');
        });

        const currentZone = zoneRef.current;
        if (currentZone?.localityQuery && searchInputRef.current.value !== currentZone.localityQuery) {
          searchInputRef.current.value = currentZone.localityQuery;
        } else if (currentZone?.city && searchInputRef.current.value !== buildReviewQuery(currentZone)) {
          searchInputRef.current.value = buildReviewQuery(currentZone);
        }

        const currentReviewQuery = buildReviewQuery(zoneRef.current);
        if (zoneRef.current?.placeId) showGoogleBoundary(zoneRef.current.placeId);
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
      if (boundaryLayerRef.current) boundaryLayerRef.current.style = null;
      vertexMarkersRef.current.forEach((marker) => marker.setMap(null));
      vertexMarkersRef.current = [];
      if (mapControlRef.current) mapControlRef.current.remove();
      mapControlRef.current = null;
      mapControlButtonsRef.current = { undo: null, clear: null };
      boundaryLayerRef.current = null;
      autocompleteRef.current = null;
      polygonRef.current = null;
      mapRef.current = null;
    };
  }, [zone?.id]);

  useEffect(() => {
    if (!polygonRef.current) return;
    const shape = Array.isArray(zone?.shape) ? zone.shape : [];
    polygonRef.current.setPath(shape);
    if (mapControlButtonsRef.current.undo) mapControlButtonsRef.current.undo.disabled = shape.length === 0;
    if (mapControlButtonsRef.current.clear) mapControlButtonsRef.current.clear.disabled = shape.length === 0;
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

  const resolveRadiusCenter = async () => {
    if (radiusSource === 'city') return zone.center || null;
    const selectedBase = bases.find((base) => String(base.id) === String(selectedBaseId));
    if (!selectedBase?.address || !window.google?.maps) return null;
    if (Number.isFinite(Number(selectedBase.lat)) && Number.isFinite(Number(selectedBase.lng))) {
      return { lat: Number(selectedBase.lat), lng: Number(selectedBase.lng) };
    }
    return new Promise((resolve) => {
      new window.google.maps.Geocoder().geocode({ address: selectedBase.address }, (results, geocoderStatus) => {
        const location = geocoderStatus === 'OK' ? results?.[0]?.geometry?.location : null;
        resolve(location ? { lat: location.lat(), lng: location.lng() } : null);
      });
    });
  };

  const generateRadius = async () => {
    const radius = Number(radiusMiles);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 250) {
      setStatus('Enter a radius between 0.1 and 250 miles.');
      return;
    }
    const center = await resolveRadiusCenter();
    if (!center) {
      setStatus(radiusSource === 'city' ? 'Search for and select a city first.' : 'Select a saved base with a valid address.');
      return;
    }
    const shape = buildRadiusPolygon(center, radius);
    onChange('shape', shape);
    onChange('radiusMiles', radius);
    onChange('radiusSource', radiusSource);
    onChange('radiusBaseId', radiusSource === 'base' ? selectedBaseId : '');
    onChange('center', center);
    if (mapRef.current && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      shape.forEach((point) => bounds.extend(point));
      mapRef.current.fitBounds(bounds, 28);
    }
    setStatus(`${radius}-mile pricing radius generated from the ${radiusSource === 'city' ? 'searched city center' : 'selected base'}.`);
  };

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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem]">
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">Charge value</label>
          <input
            type="number"
            value={zone.price ?? ''}
            onChange={(e) => onChange('price', e.target.value)}
            placeholder={(zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge')) === 'flat_rate' || zone.surchargeFeeType === 'flat' ? '75' : '25'}
            className="w-full rounded border border-slate-700 bg-[#080c14] p-2 text-white font-mono"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">Priority</label>
          <input type="number" min="0" max="999" step="1" value={zone.priority ?? 0} onChange={(e) => onChange('priority', e.target.value)} className="w-full rounded border border-slate-700 bg-[#080c14] p-2 text-white font-mono" />
        </div>
        <p className="text-[10px] text-slate-500 sm:col-span-2">Higher priority wins when zones overlap. Zones tied at the highest priority stack together.</p>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-700 bg-[#0b1220] p-2.5">
        <div>
          <p className="text-[10px] font-semibold text-slate-300">Generate a radius</p>
          <p className="text-[10px] text-slate-500">Replace the current shape with a circle from the searched city center or a saved base.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_1fr_7rem]">
          <select value={radiusSource} onChange={(e) => setRadiusSource(e.target.value)} aria-label="Radius center source" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white">
            <option value="city">City center</option>
            <option value="base">Saved base</option>
          </select>
          {radiusSource === 'base' ? (
            <select value={selectedBaseId} onChange={(e) => setSelectedBaseId(e.target.value)} aria-label="Radius base" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white">
              <option value="">Select a base</option>
              {bases.map((base) => <option key={base.id} value={base.id}>{base.name || base.address}</option>)}
            </select>
          ) : (
            <div className="flex items-center rounded border border-slate-800 px-2 text-[10px] text-slate-400">{zone.localityQuery || 'Select a city above'}</div>
          )}
          <div className="flex items-center rounded border border-slate-700 bg-[#080c14] pr-2">
            <input type="number" min="0.1" max="250" step="0.1" value={radiusMiles} onChange={(e) => setRadiusMiles(e.target.value)} aria-label="Radius in miles" className="min-w-0 flex-1 bg-transparent p-2 text-white font-mono outline-none" />
            <span className="text-[10px] text-slate-500">mi</span>
          </div>
        </div>
        <button type="button" onClick={generateRadius} className="w-full rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-[10px] font-semibold text-cyan-200">Generate radius polygon</button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-semibold text-slate-300">Municipality and pricing boundary</p>
            <p className="text-[10px] text-slate-500"><span className="font-semibold text-orange-400">Orange</span> is Google&apos;s municipality reference. Click matching points to draw TowCalc&apos;s <span className="font-semibold text-cyan-400">cyan</span> pricing polygon.</p>
          </div>
          <div ref={mapElementRef} role="application" aria-label="Draw city-limit boundary" className="h-72 overflow-hidden rounded-lg border border-slate-700 bg-[#080c14]" />
          {!MAP_ID && <p className="text-[10px] text-amber-300">Google&apos;s reference layer needs a configured vector Map ID. Polygon drawing still works.</p>}
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
