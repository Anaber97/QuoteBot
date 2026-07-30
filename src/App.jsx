import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import { SHOP_LOCATIONS } from './config/locations';
import { GEOFENCES } from './config/geofences';
import { RATES } from './config/rates';
import { supabase } from './lib/supabase';
import QuoteLog from './components/QuoteLog';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Utility Helper
const roundToNearest = (val, interval = RATES.ROUNDING_INTERVAL) => Math.round(val / interval) * interval;

// Initial State for Reducer
const initialState = {
  activeTab: 'calculator', // 'calculator' | 'log'
  selectedBaseId: SHOP_LOCATIONS[0].id,
  waypoints: ['', ''],
  isAfterHours: false,
  isRoadClub: false,
  isMetro: false,
  isHeavy: false,
  activeOverrides: { afterHours: true, roadClub: true, metro: true },
  showDetails: false,
  customerName: '',
  customerPhone: '',
  saveStatus: null,
  isSaving: false,
  mapUrl: '',
  customRate: '',
  isApiLoaded: false,
  loading: false,
  error: null,
  quoteData: null,
};

// Reducer Function
function quoteReducer(state, action) {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_BASE':
      return { ...state, selectedBaseId: action.payload };
    case 'SET_WAYPOINT': {
      const updated = [...state.waypoints];
      updated[action.payload.index] = action.payload.value;
      return { ...state, waypoints: updated };
    }
    case 'ADD_WAYPOINT': {
      const updated = [...state.waypoints];
      updated.splice(updated.length - 1, 0, '');
      return { ...state, waypoints: updated };
    }
    case 'REMOVE_WAYPOINT': {
      if (state.waypoints.length <= 2) return state;
      return { ...state, waypoints: state.waypoints.filter((_, i) => i !== action.payload) };
    }
    case 'TOGGLE_SURCHARGE':
      return { ...state, [action.payload]: !state[action.payload] };
    case 'TOGGLE_OVERRIDE':
      return {
        ...state,
        activeOverrides: {
          ...state.activeOverrides,
          [action.payload]: !state.activeOverrides[action.payload],
        },
      };
    case 'SET_CUSTOMER_INFO':
      return { ...state, [action.payload.field]: action.payload.value };
    case 'SET_CUSTOM_RATE':
      return { ...state, customRate: action.payload };
    case 'TOGGLE_DETAILS':
      return { ...state, showDetails: !state.showDetails };
    case 'API_LOADED':
      return { ...state, isApiLoaded: true };
    case 'CALCULATE_START':
      return {
        ...state,
        loading: true,
        error: null,
        saveStatus: null,
        activeOverrides: { afterHours: true, roadClub: true, metro: true },
      };
    case 'CALCULATE_SUCCESS':
      return {
        ...state,
        loading: false,
        quoteData: action.payload.quoteData,
        mapUrl: action.payload.mapUrl,
      };
    case 'CALCULATE_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SAVE_START':
      return { ...state, isSaving: true, saveStatus: null };
    case 'SAVE_SUCCESS':
      return { ...state, isSaving: false, saveStatus: { type: 'success', message: 'Quote logged successfully!' } };
    case 'SAVE_ERROR':
      return { ...state, isSaving: false, saveStatus: { type: 'error', message: action.payload } };
    case 'RESET':
      return {
        ...initialState,
        isApiLoaded: state.isApiLoaded, // retain loaded script state
      };
    default:
      return state;
  }
}

// Memoized Individual Input Component
const WaypointInput = React.memo(({ index, totalWaypoints, value, onChange, onRemove, inputRef }) => {
  const isPickUp = index === 0;
  const isDropOff = index === totalWaypoints - 1;
  const isWaypoint = !isPickUp && !isDropOff;
  const label = isPickUp ? 'Pick-up Location' : isDropOff ? 'Drop-off Location' : `Stop ${index} (Waypoint)`;

  return (
    <div>
      <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder={`Enter ${label.toLowerCase()}...`}
          value={value}
          onChange={(e) => onChange(index, e.target.value)}
          className="flex-1 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none text-sm shadow-inner"
        />
        {isWaypoint && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove waypoint ${index}`}
            className="bg-red-950/40 hover:bg-red-900/50 text-red-400 w-11 h-11 rounded-xl border border-red-800/50 font-bold text-lg flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
});

export default function App() {
  const [state, dispatch] = useReducer(quoteReducer, initialState);
  const {
    activeTab,
    selectedBaseId,
    waypoints,
    isAfterHours,
    isRoadClub,
    isMetro,
    activeOverrides,
    showDetails,
    customerName,
    customerPhone,
    saveStatus,
    isSaving,
    mapUrl,
    customRate,
    isApiLoaded,
    loading,
    error,
    quoteData,
  } = state;

  const currentBase = SHOP_LOCATIONS.find((b) => b.id === selectedBaseId) || SHOP_LOCATIONS[0];
  const inputRefs = useRef([]);
  const autocompleteInstances = useRef(new Map());

  // Issue 1: Script Load Cleanup
  useEffect(() => {
    if (window.google?.maps?.places?.geometry) {
      dispatch({ type: 'API_LOADED' });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => dispatch({ type: 'API_LOADED' });
    script.onerror = () => dispatch({ type: 'CALCULATE_ERROR', payload: 'Failed to load Google Maps SDK.' });
    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) existingScript.remove();
    };
  }, []);

  // Issue 2 & 6: Autocomplete with Ref Map & Direct Binding
  const handleWaypointChange = useCallback((index, value) => {
    dispatch({ type: 'SET_WAYPOINT', payload: { index, value } });
  }, []);

  const handleRemoveWaypoint = useCallback((index) => {
    dispatch({ type: 'REMOVE_WAYPOINT', payload: index });
  }, []);

  useEffect(() => {
    if (!isApiLoaded || activeTab !== 'calculator') return;

    const options = {
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'us' },
    };

    waypoints.forEach((_, index) => {
      const ref = inputRefs.current[index];
      if (ref && !autocompleteInstances.current.has(ref)) {
        const autocomplete = new window.google.maps.places.Autocomplete(ref, options);
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place?.formatted_address) {
            handleWaypointChange(index, place.formatted_address);
          } else if (ref.value) {
            handleWaypointChange(index, ref.value);
          }
        });
        autocompleteInstances.current.set(ref, autocomplete);
      }
    });

    return () => {
      // Clean up unmounted input references
      autocompleteInstances.current.forEach((_, ref) => {
        if (!document.body.contains(ref)) {
          autocompleteInstances.current.delete(ref);
        }
      });
    };
  }, [isApiLoaded, activeTab, waypoints, handleWaypointChange]);

  // Issue 3: Batch Geocoding
  const geocodeAll = async (addresses) => {
    const geocoder = new window.google.maps.Geocoder();
    return Promise.all(
      addresses.map(
        (addr) =>
          new Promise((res) => {
            if (!addr.trim()) return res(null);
            geocoder.geocode({ address: addr }, (results, status) => {
              if (status === 'OK' && results[0]) {
                const loc = results[0].geometry.location;
                res({ lat: loc.lat(), lng: loc.lng() });
              } else {
                res(null);
              }
            });
          })
      )
    );
  };

  const checkGeofenceZone = async (zoneConfig, addresses, coordsList) => {
    const isPointInBox = (lat, lng) => {
      const { box } = zoneConfig;
      return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
    };

    // Keyword match
    const hasKeyword = addresses.some((addr) =>
      zoneConfig.cities.some((city) => addr.toLowerCase().includes(city))
    );
    if (hasKeyword) return true;

    // Coordinate match using pre-geocoded batch
    const directHit = coordsList.some((c) => c && isPointInBox(c.lat, c.lng));
    if (directHit) return true;

    // Route directions match
    return new Promise((resolve) => {
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin: addresses[0],
          destination: addresses[addresses.length - 1],
          waypoints: addresses.slice(1, -1).map((addr) => ({ location: addr, stopover: true })),
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK' && result.routes[0]) {
            const passesThrough = result.routes[0].legs.some((leg) => {
              const startIn = isPointInBox(leg.start_location.lat(), leg.start_location.lng());
              const endIn = isPointInBox(leg.end_location.lat(), leg.end_location.lng());
              if (startIn || endIn) return true;
              return (leg.steps || []).some((step) =>
                (step.path || []).some((pt) => isPointInBox(pt.lat(), pt.lng()))
              );
            });
            resolve(passesThrough);
          } else {
            resolve(false);
          }
        }
      );
    });
  };

  const handleCalculate = async (e) => {
    if (e) e.preventDefault();

    const cleanWaypoints = waypoints.map((w) => w.trim()).filter(Boolean);
    if (cleanWaypoints.length < 2) {
      dispatch({ type: 'CALCULATE_ERROR', payload: 'Please enter at least a Pick-up and Drop-off location.' });
      return;
    }

    dispatch({ type: 'CALCULATE_START' });

    const routeWaypoints = cleanWaypoints.slice(0, -1); // All points except final return to base
const origin = encodeURIComponent(currentBase.address);
const destination = encodeURIComponent(currentBase.address);
const waypointsParam = routeWaypoints.map(addr => encodeURIComponent(addr)).join('|');

const generatedMapUrl = `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}&mode=driving`;

    try {
      // Single Batch Geocode
      const coordsList = await geocodeAll(cleanWaypoints);

      const [hitDFW, hitHouston] = await Promise.all([
        checkGeofenceZone(GEOFENCES.dfw, cleanWaypoints, coordsList),
        checkGeofenceZone(GEOFENCES.houston, cleanWaypoints, coordsList),
      ]);

      const routePoints = [currentBase.address, ...cleanWaypoints, currentBase.address];
      const distanceService = new window.google.maps.DistanceMatrixService();

      let totalDriveSeconds = 0;
      const legsDetails = [];

      for (let i = 0; i < routePoints.length - 1; i++) {
        const response = await new Promise((res, rej) => {
          distanceService.getDistanceMatrix(
            {
              origins: [routePoints[i]],
              destinations: [routePoints[i + 1]],
              travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (resData, status) => {
              if (status === 'OK') res(resData);
              else rej(status);
            }
          );
        });

        const legSec = response.rows[0].elements[0].duration.value;
        totalDriveSeconds += legSec;

        let label = `Leg ${i + 1}`;
        if (i === 0) label = 'Base → Pick-up';
        else if (i === routePoints.length - 2) label = 'Drop-off → Base';
        else if (i === 1) label = 'Pick-up → Stop 1';
        else label = `Stop ${i - 1} → Stop ${i}`;

        legsDetails.push({ label, minutes: Math.round(legSec / 60) });
      }

      // Issue 4: Using Extracted RATES Constants
      const totalDriveMinutes = totalDriveSeconds / 60;
      const adjustedDriveMinutes = totalDriveMinutes * RATES.DRIVE_TIME_BUFFER;
      const loadUnloadTime = RATES.LOAD_UNLOAD_BASE_MINS + (cleanWaypoints.length - 2) * RATES.EXTRA_STOP_MINS;
      const totalJobMinutes = adjustedDriveMinutes + loadUnloadTime;
      const totalHours = totalJobMinutes / 60;

      const hasAnyMetroZone = hitDFW || hitHouston || isMetro;

      dispatch({
        type: 'CALCULATE_SUCCESS',
        payload: {
          mapUrl: generatedMapUrl,
          quoteData: {
            cleanWaypoints,
            legsDetails,
            adjustedDriveMin: Math.round(adjustedDriveMinutes),
            loadUnloadTime,
            rawTotalHours: totalHours,
            totalHours: totalHours.toFixed(2),
            isHeavy,
            minRate,
            maxRate,
            baseMinQuote: roundToNearest(totalHours * RATES.HOURLY_MIN),
            baseMaxQuote: roundToNearest(totalHours * RATES.HOURLY_MAX),
            hasAfterHours: isAfterHours,
            hasRoadClub: isRoadClub,
            hasMetroZone: hasAnyMetroZone,
          },
        },
      });
    } catch (err) {
      // Issue 8: Specific Error Catching
      console.error('Calculation error:', err);
      const message = err?.message?.includes('OVER_QUERY_LIMIT') || err?.includes?.('OVER_QUERY_LIMIT')
        ? 'Google Maps API limit exceeded. Please try again later.'
        : err?.message || 'An error occurred calculating the quote.';
      dispatch({ type: 'CALCULATE_ERROR', payload: message });
    }
  };

  // Recalculations
  let effectiveMultiplier = 1.0;
  if (quoteData) {
    if (quoteData.hasAfterHours && activeOverrides.afterHours) effectiveMultiplier *= RATES.AFTER_HOURS_MULTIPLIER;
    if (quoteData.hasRoadClub && activeOverrides.roadClub) effectiveMultiplier *= RATES.ROAD_CLUB_MULTIPLIER;
    if (quoteData.hasMetroZone && activeOverrides.metro) effectiveMultiplier *= RATES.METRO_MULTIPLIER;
  }

  const currentMinQuote = quoteData ? roundToNearest(quoteData.rawTotalHours * RATES.HOURLY_MIN * effectiveMultiplier) : 0;
  const currentMaxQuote = quoteData ? roundToNearest(quoteData.rawTotalHours * RATES.HOURLY_MAX * effectiveMultiplier) : 0;

  const customCalculatedQuote =
    quoteData && customRate && !isNaN(parseFloat(customRate))
      ? roundToNearest(quoteData.rawTotalHours * parseFloat(customRate) * effectiveMultiplier)
      : null;

  const handleLogQuote = async () => {
    if (!quoteData) return;
    dispatch({ type: 'SAVE_START' });

    const activeModifiers = [];
    if (quoteData.hasAfterHours && activeOverrides.afterHours) activeModifiers.push('+25% After Hours');
    if (quoteData.hasRoadClub && activeOverrides.roadClub) activeModifiers.push('+15% Road Club');
    if (quoteData.hasMetroZone && activeOverrides.metro) activeModifiers.push('+28.57% Metro');

    const { error } = await supabase.from('quotes').insert([
      {
        base_location: currentBase.name,
        customer_name: customerName.trim() || 'N/A',
        customer_phone: customerPhone.trim() || 'N/A',
        waypoints: quoteData.cleanWaypoints,
        estimated_hours: parseFloat(quoteData.totalHours),
        quote_min: currentMinQuote,
        quote_max: currentMaxQuote,
        custom_rate: customRate ? parseFloat(customRate) : null,
        surcharges_applied: activeModifiers,
      },
    ]);

    if (error) {
      dispatch({ type: 'SAVE_ERROR', payload: error.message });
    } else {
      dispatch({ type: 'SAVE_SUCCESS' });
    }
  };

  // Dynamic base rates
const baseMinRate = quoteData?.isHeavy ? RATES.HEAVY_HOURLY_MIN : RATES.HOURLY_MIN;
const baseMaxRate = quoteData?.isHeavy ? RATES.HEAVY_HOURLY_MAX : RATES.HOURLY_MAX;

const currentMinQuote = quoteData ? roundToNearest(quoteData.rawTotalHours * baseMinRate * effectiveMultiplier) : 0;
const currentMaxQuote = quoteData ? roundToNearest(quoteData.rawTotalHours * baseMaxRate * effectiveMultiplier) : 0;

  return (
    <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-6 text-slate-200">
      <div className="max-w-xl w-full bg-[#161b26] rounded-2xl shadow-2xl p-8 border border-slate-800">
        
        {/* Navigation Tabs */}
        <div className="flex bg-[#0b0f17] border border-slate-800 rounded-xl p-1 mb-8">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_TAB', payload: 'calculator' })}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'calculator' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Calculator
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_TAB', payload: 'log' })}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'log' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Quote Log
          </button>
        </div>

        {activeTab === 'log' ? (
          <QuoteLog />
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight mb-3">Towing Quote Calculator</h1>
              <div className="flex items-center gap-2">
                <label htmlFor="baseShopSelect" className="text-xs uppercase font-semibold text-slate-400">Base Location:</label>
                <select
                  id="baseShopSelect"
                  value={selectedBaseId}
                  onChange={(e) => dispatch({ type: 'SET_BASE', payload: e.target.value })}
                  className="bg-[#1f2636] border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {SHOP_LOCATIONS.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name} ({shop.address})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCalculate} className="space-y-6">
              <div className="grid grid-cols-1 gap-2.5">
                <div className="flex items-center gap-3 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        id="heavy"
        checked={isHeavy}
        onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isHeavy' })}
        className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
      />
      <label htmlFor="heavy" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
        Heavy Duty Towing <span className="text-amber-400 font-bold">($200 – $250/hr)</span>
      </label>
    </div>
                <div className="flex items-center gap-3 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="afterHours"
                    checked={isAfterHours}
                    onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isAfterHours' })}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                  <label htmlFor="afterHours" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
                    After Hours / Weekend Callout <span className="text-blue-400 font-bold">(+25%)</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="roadClub"
                    checked={isRoadClub}
                    onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isRoadClub' })}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                  <label htmlFor="roadClub" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
                    Road Club Account <span className="text-blue-400 font-bold">(+15%)</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="metro"
                    checked={isMetro}
                    onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isMetro' })}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                  <label htmlFor="metro" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
                    Manual Metro Surcharge <span className="text-blue-400 font-bold">(+28.57%)</span>
                  </label>
                </div>
              </div>

              {/* Dynamic Memoized Waypoints */}
              <div className="space-y-4">
                {waypoints.map((address, index) => (
                  <WaypointInput
                    key={index}
                    index={index}
                    totalWaypoints={waypoints.length}
                    value={address}
                    onChange={handleWaypointChange}
                    onRemove={handleRemoveWaypoint}
                    inputRef={(el) => (inputRefs.current[index] = el)}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => dispatch({ type: 'ADD_WAYPOINT' })}
                  className="w-full py-2.5 px-4 bg-[#1f2636] hover:bg-slate-700/70 border border-slate-700/80 text-blue-400 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="text-base font-bold">+</span> Add Waypoint Stop
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading || !isApiLoaded}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-600/20 transition duration-200 disabled:bg-slate-800 disabled:text-slate-500 cursor-pointer text-base"
                >
                  {loading ? 'Checking Routes & Geofences...' : 'Generate Quote'}
                </button>

                <button
                  type="button"
                  onClick={() => dispatch({ type: 'RESET' })}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3.5 px-5 rounded-xl border border-slate-700 transition duration-200 cursor-pointer text-base"
                >
                  Reset
                </button>
              </div>
            </form>

            {/* Results Display */}
            {quoteData && (
              <div className="mt-8 border-t border-slate-800/80 pt-8">
                {mapUrl && (
                  <div className="mb-6 rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-[#0b0f17]">
                    <iframe title="Route Map" width="100%" height="260" style={{ border: 0 }} loading="lazy" allowFullScreen src={mapUrl}></iframe>
                  </div>
                )}

                <div className="bg-gradient-to-b from-[#1c2436] to-[#121722] border border-blue-500/30 rounded-2xl p-6 text-center shadow-xl mb-6 relative">
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    {quoteData.hasAfterHours && (
                      <span className="text-xs uppercase tracking-widest font-bold text-blue-400">
  Estimated Quote Range (${quoteData.isHeavy ? `${RATES.HEAVY_HOURLY_MIN} – $${RATES.HEAVY_HOURLY_MAX}` : `${RATES.HOURLY_MIN} – $${RATES.HOURLY_MAX}`}/hr)
</span>
                    )}

                    {quoteData.hasRoadClub && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition ${activeOverrides.roadClub ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-slate-800/80 text-slate-500 border-slate-700 line-through'}`}>
                        +15% Road Club
                        <button type="button" onClick={() => dispatch({ type: 'TOGGLE_OVERRIDE', payload: 'roadClub' })} className="hover:text-white font-bold ml-0.5 cursor-pointer">
                          {activeOverrides.roadClub ? '✕' : '↺'}
                        </button>
                      </span>
                    )}

                    {quoteData.hasMetroZone && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition ${activeOverrides.metro ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-slate-800/80 text-slate-500 border-slate-700 line-through'}`}>
                        +28.57% Metro
                        <button type="button" onClick={() => dispatch({ type: 'TOGGLE_OVERRIDE', payload: 'metro' })} className="hover:text-white font-bold ml-0.5 cursor-pointer">
                          {activeOverrides.metro ? '✕' : '↺'}
                        </button>
                      </span>
                    )}
                  </div>

                  <span className="text-xs uppercase tracking-widest font-bold text-blue-400">
                    Estimated Quote Range (${RATES.HOURLY_MIN} – ${RATES.HOURLY_MAX}/hr)
                  </span>
                  <p className="text-4xl font-black text-white mt-2 tracking-tight">${currentMinQuote} – ${currentMaxQuote}</p>
                  <p className="text-xs text-slate-400 mt-2">Rounded to nearest $25</p>

                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'TOGGLE_DETAILS' })}
                    className="mt-4 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4 cursor-pointer transition"
                  >
                    {showDetails ? '▲ Hide Trip Breakdown' : '▼ Show Trip Breakdown'}
                  </button>
                </div>

                {showDetails && (
                  <div className="bg-[#0b0f17] border border-slate-800 rounded-xl p-5 space-y-3 text-sm mb-6 shadow-inner">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Route & Time Breakdown</h3>
                    {quoteData.legsDetails.map((leg, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                        <span>{leg.label}</span>
                        <span className="font-semibold text-slate-200">{leg.minutes} mins</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                      <span>Adjusted Drive Time (+10%)</span>
                      <span className="font-semibold text-slate-200">{quoteData.adjustedDriveMin} mins</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                      <span>Load / Unload Flat Rate</span>
                      <span className="font-semibold text-slate-200">{quoteData.loadUnloadTime} mins</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                      <span>Metro / Geofence Status</span>
                      <span className={`font-semibold ${quoteData.hasMetroZone && activeOverrides.metro ? 'text-purple-400' : 'text-slate-200'}`}>
                        {quoteData.hasMetroZone ? (activeOverrides.metro ? 'Applied (+28.57%)' : 'Removed (0%)') : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                      <span>Base Price Range (No Surcharges)</span>
                      <span className="font-semibold text-emerald-400">${quoteData.baseMinQuote} – ${quoteData.baseMaxQuote}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 text-base font-bold text-white">
                      <span>Total Billable Hours</span>
                      <span className="text-blue-400">{quoteData.totalHours} hrs</span>
                    </div>
                  </div>
                )}

                <div className="bg-[#1f2636]/60 border border-slate-700/80 rounded-xl p-4 mb-6 shadow-md">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-slate-300 mb-2">Custom Hourly Rate</label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-base">$</span>
                      <input
                        type="number"
                        placeholder="Enter rate (e.g. 150)"
                        value={customRate}
                        onChange={(e) => dispatch({ type: 'SET_CUSTOM_RATE', payload: e.target.value })}
                        className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none text-base"
                      />
                    </div>
                    {customCalculatedQuote !== null && (
                      <div className="bg-blue-600/20 border border-blue-500/40 rounded-lg px-4 py-2 text-right">
                        <span className="text-[10px] uppercase tracking-wider block text-blue-300 font-bold">Custom Quote</span>
                        <span className="text-xl font-extrabold text-white">${customCalculatedQuote}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#1f2636]/60 border border-slate-700/80 rounded-xl p-4 mb-6 space-y-3">
                  <span className="block text-xs uppercase tracking-wider font-semibold text-slate-300">Log Quote to Database (Optional)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={(e) => dispatch({ type: 'SET_CUSTOMER_INFO', payload: { field: 'customerName', value: e.target.value } })}
                      className="bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={customerPhone}
                      onChange={(e) => dispatch({ type: 'SET_CUSTOMER_INFO', payload: { field: 'customerPhone', value: e.target.value } })}
                      className="bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleLogQuote}
                    disabled={isSaving}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg transition disabled:bg-slate-800 cursor-pointer"
                  >
                    {isSaving ? 'Saving Quote...' : '💾 Log Quote'}
                  </button>

                  {saveStatus && (
                    <p className={`text-xs text-center font-medium ${saveStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {saveStatus.message}
                    </p>
                  )}
                </div>

              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}