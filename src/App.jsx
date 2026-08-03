// @ts-check
import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import { SHOP_LOCATIONS } from './config/locations';
import { RATES } from './config/rates';
import { evaluateMetroGeofences, evaluateHazardGeofences } from './utils/geofenceEngine';
import { supabase } from './lib/supabase';
import QuoteLog from './components/QuoteLog';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const roundToNearest = (val, interval = RATES.ROUNDING_INTERVAL) => Math.round(val / interval) * interval;

const initialState = {
  activeTab: 'calculator',
  selectedBaseId: SHOP_LOCATIONS[0].id,
  waypoints: ['', ''],
  isAfterHours: false,
  isRoadClub: false,
  isMetro: false,
  isHazard: false,
  isHeavy: false,
  activeOverrides: { afterHours: true, roadClub: true, metro: true, hazard: true },
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
        activeOverrides: { afterHours: true, roadClub: true, metro: true, hazard: true },
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
    case 'LOAD_QUOTE_INTO_CALCULATOR': {
      const matchingBase = SHOP_LOCATIONS.find((b) => b.name === action.payload.base_location);
      return {
        ...state,
        activeTab: 'calculator',
        waypoints: action.payload.waypoints?.length ? action.payload.waypoints : ['', ''],
        selectedBaseId: matchingBase ? matchingBase.id : state.selectedBaseId,
        customerName: action.payload.customer_name !== 'N/A' ? action.payload.customer_name || '' : '',
        customerPhone: action.payload.customer_phone !== 'N/A' ? action.payload.customer_phone || '' : '',
        quoteData: null,
        error: null,
      };
    }
    case 'RESET':
      return {
        ...initialState,
        isApiLoaded: state.isApiLoaded,
      };
    default:
      return state;
  }
}

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

export default function App() {
  const [state, dispatch] = useReducer(quoteReducer, initialState);
  const {
    activeTab,
    selectedBaseId,
    waypoints,
    isAfterHours,
    isRoadClub,
    isMetro,
    isHazard,
    isHeavy,
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
  const lastCalculationTime = useRef(0);
  const resultsRef = useRef(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      dispatch({
        type: 'CALCULATE_ERROR',
        payload: 'Google Maps API key is missing. Please check configuration.',
      });
    }
  }, []);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;

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
      const instances = autocompleteInstances.current;
      instances.forEach((_, ref) => {
        if (ref && ref.dataset) {
          ref.dataset.autocompleteAttached = 'false';
        }
      });
      instances.clear();
    };
  }, [isApiLoaded, activeTab, waypoints, handleWaypointChange]);

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

  const handleCalculate = async (e) => {
    if (e) e.preventDefault();

    const now = Date.now();
    if (now - lastCalculationTime.current < 2000) {
      dispatch({
        type: 'CALCULATE_ERROR',
        payload: 'Please wait 2 seconds between calculation requests.',
      });
      return;
    }
    lastCalculationTime.current = now;

    const cleanWaypoints = waypoints.map((w) => w.trim()).filter(Boolean);
    if (cleanWaypoints.length < 2) {
      dispatch({ type: 'CALCULATE_ERROR', payload: 'Please enter at least a Pick-up and Drop-off location.' });
      return;
    }

    dispatch({ type: 'CALCULATE_START' });

    const origin = encodeURIComponent(currentBase.address);
    const destination = encodeURIComponent(currentBase.address);
    const waypointsParam = cleanWaypoints.map((addr) => encodeURIComponent(addr)).join('|');
    const generatedMapUrl = `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}&mode=driving`;

    try {
      const coordsList = await geocodeAll(cleanWaypoints);

      const [hitMetroZone, hitHazardZone] = await Promise.all([
        evaluateMetroGeofences(cleanWaypoints, coordsList),
        evaluateHazardGeofences(cleanWaypoints, coordsList),
      ]);

      const routePoints = [currentBase.address, ...cleanWaypoints, currentBase.address];
      const distanceService = new window.google.maps.DistanceMatrixService();

      const matrixPromises = routePoints.slice(0, -1).map((originPt, i) => {
        const destPt = routePoints[i + 1];
        return new Promise((res, rej) => {
          distanceService.getDistanceMatrix(
            {
              origins: [originPt],
              destinations: [destPt],
              travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (resData, status) => {
              if (status === 'OK') res({ index: i, data: resData });
              else rej(status);
            }
          );
        });
      });

      const matrixResults = await Promise.all(matrixPromises);
      let totalDriveSeconds = 0;
      const legsDetails = [];

      matrixResults.sort((a, b) => a.index - b.index);

      matrixResults.forEach(({ index: i, data }) => {
        const legSec = data.rows[0].elements[0].duration.value;
        totalDriveSeconds += legSec;

        let label = `Leg ${i + 1}`;
        if (i === 0) label = 'Base → Pick-up';
        else if (i === routePoints.length - 2) label = 'Drop-off → Base';
        else if (i === 1) label = 'Pick-up → Stop 1';
        else label = `Stop ${i - 1} → Stop ${i}`;

        legsDetails.push({ label, minutes: Math.round(legSec / 60) });
      });

      const totalDriveMinutes = totalDriveSeconds / 60;
      const adjustedDriveMinutes = totalDriveMinutes * RATES.DRIVE_TIME_BUFFER;
      const loadUnloadTime = RATES.LOAD_UNLOAD_BASE_MINS + (cleanWaypoints.length - 2) * RATES.EXTRA_STOP_MINS;
      const totalJobMinutes = adjustedDriveMinutes + loadUnloadTime;
      const totalHours = totalJobMinutes / 60;

      const minRate = isHeavy ? RATES.HEAVY_HOURLY_MIN : RATES.HOURLY_MIN;
      const maxRate = isHeavy ? RATES.HEAVY_HOURLY_MAX : RATES.HOURLY_MAX;

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
            baseMinQuote: roundToNearest(totalHours * minRate),
            baseMaxQuote: roundToNearest(totalHours * maxRate),
            hasAfterHours: isAfterHours,
            hasRoadClub: isRoadClub,
            hasMetroZone: hitMetroZone || isMetro,
            hasHazardZone: hitHazardZone || isHazard,
          },
        },
      });
    } catch (err) {
      console.error('Calculation error:', err);
      const message = err?.message?.includes('OVER_QUERY_LIMIT')
        ? 'Google Maps API limit exceeded. Please try again later.'
        : err?.message || 'An error occurred calculating the quote.';
      dispatch({ type: 'CALCULATE_ERROR', payload: message });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (stateRef.current.activeTab !== 'calculator') return;

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        if (!stateRef.current.loading && stateRef.current.isApiLoaded) {
          const form = document.querySelector('form');
          if (form) form.requestSubmit();
        }
      }

      if ((isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'r') || e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'RESET' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (quoteData && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [quoteData]);

  let effectiveMultiplier = 1.0;
  if (quoteData) {
    if (quoteData.hasAfterHours && activeOverrides.afterHours) effectiveMultiplier *= RATES.AFTER_HOURS_MULTIPLIER;
    if (quoteData.hasRoadClub && activeOverrides.roadClub) effectiveMultiplier *= RATES.ROAD_CLUB_MULTIPLIER;
    if (quoteData.hasMetroZone && activeOverrides.metro) effectiveMultiplier *= RATES.METRO_MULTIPLIER;
    if (quoteData.hasHazardZone && activeOverrides.hazard) effectiveMultiplier *= 1.40;
  }

  const baseMinRate = quoteData?.isHeavy ? RATES.HEAVY_HOURLY_MIN : RATES.HOURLY_MIN;
  const baseMaxRate = quoteData?.isHeavy ? RATES.HEAVY_HOURLY_MAX : RATES.HOURLY_MAX;

  const currentMinQuote = quoteData ? roundToNearest(quoteData.rawTotalHours * baseMinRate * effectiveMultiplier) : 0;
  const currentMaxQuote = quoteData ? roundToNearest(quoteData.rawTotalHours * baseMaxRate * effectiveMultiplier) : 0;

  const customCalculatedQuote =
    quoteData && customRate && !isNaN(parseFloat(customRate))
      ? roundToNearest(quoteData.rawTotalHours * parseFloat(customRate) * effectiveMultiplier)
      : null;

  const handleLogQuote = async () => {
    if (!quoteData) return;
    dispatch({ type: 'SAVE_START' });

    const activeModifiers = [];
    if (quoteData.isHeavy) activeModifiers.push('Heavy Duty Rate');
    if (quoteData.hasAfterHours && activeOverrides.afterHours) activeModifiers.push('+25% After Hours');
    if (quoteData.hasRoadClub && activeOverrides.roadClub) activeModifiers.push('+15% Road Club');
    if (quoteData.hasMetroZone && activeOverrides.metro) activeModifiers.push('+28.57% Metro');
    if (quoteData.hasHazardZone && activeOverrides.hazard) activeModifiers.push('+40% Hazard Zone');

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

  return (
    <div className="min-h-screen w-full bg-[#080c14] flex flex-col items-center justify-center p-4 sm:p-6 text-slate-200">
      
      {/* Central Container Card */}
      <div className="w-full max-w-md sm:max-w-xl bg-[#121824] rounded-2xl shadow-2xl p-5 sm:p-8 border border-slate-800/80">

        {/* 1. Single Logo Header */}
        <div className="flex flex-col items-center justify-center mb-6 px-2">
          <img 
            src="/logo-trn.png" 
            alt="TowCalc Pro Logo" 
            className="w-[400px] max-w-full h-auto object-contain block drop-shadow-[0_4px_12px_rgba(59,130,246,0.3)]" 
          />
          <span className="mt-2 text-[10px] uppercase font-mono tracking-widest text-blue-400/90 bg-blue-500/10 border border-blue-500/20 px-3 py-0.5 rounded-full">
            Dispatch & Route Rate Engine
          </span>
        </div>

        {/* 2. Navigation Tabs */}
        <div className="flex bg-[#080c14] border border-slate-800/80 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_TAB', payload: 'calculator' })}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'calculator' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Calculator
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_TAB', payload: 'log' })}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'log' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Quote Log
          </button>
        </div>

        {activeTab === 'log' ? (
          <QuoteLog
            onSelectQuote={(log) =>
              dispatch({ type: 'LOAD_QUOTE_INTO_CALCULATOR', payload: log })
            }
          />
        ) : (
          <>
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label htmlFor="baseShopSelect" className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Base Location
              </label>
              <select
                id="baseShopSelect"
                value={selectedBaseId}
                onChange={(e) => dispatch({ type: 'SET_BASE', payload: e.target.value })}
                className="bg-[#1a2130] border border-slate-700/80 text-white text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full sm:w-auto"
              >
                {SHOP_LOCATIONS.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} ({shop.address})
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="mb-5 p-4 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCalculate} className="space-y-5">
              
              {/* Symmetrical 2-Column Surcharge Checkbox Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Heavy Duty Towing - Spanning Both Columns Across the Top */}
                <div className="sm:col-span-2 flex items-center gap-3 bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer select-none">
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

                {/* Column 1: After Hours */}
                <div className="flex items-center gap-3 bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="afterHours"
                    checked={isAfterHours}
                    onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isAfterHours' })}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                  <label htmlFor="afterHours" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
                    After Hours <span className="text-blue-400 font-bold">(+25%)</span>
                  </label>
                </div>

                {/* Column 2: Road Club Account */}
                <div className="flex items-center gap-3 bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="roadClub"
                    checked={isRoadClub}
                    onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isRoadClub' })}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                  <label htmlFor="roadClub" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
                    Road Club <span className="text-blue-400 font-bold">(+15%)</span>
                  </label>
                </div>

                {/* Column 1: Manual Metro Surcharge */}
                <div className="flex items-center gap-3 bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="metro"
                    checked={isMetro}
                    onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isMetro' })}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                  <label htmlFor="metro" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
                    Manual Metro <span className="text-blue-400 font-bold">(+28.57%)</span>
                  </label>
                </div>

                {/* Column 2: Manual Hazard Surcharge */}
                <div className="flex items-center gap-3 bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="hazard"
                    checked={isHazard}
                    onChange={() => dispatch({ type: 'TOGGLE_SURCHARGE', payload: 'isHazard' })}
                    className="w-4 h-4 accent-red-500 rounded cursor-pointer"
                  />
                  <label htmlFor="hazard" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
                    Manual Hazard <span className="text-red-400 font-bold">(+40%)</span>
                  </label>
                </div>
              </div>

              {/* Waypoint Inputs */}
              <div className="space-y-3">
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
                  className="w-full py-2 px-4 bg-[#1a2130] hover:bg-slate-700/60 border border-slate-700/80 text-blue-400 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="text-sm font-bold">+</span> Add Waypoint Stop
                </button>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={loading || !isApiLoaded}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3 px-5 rounded-xl shadow-lg shadow-blue-600/25 transition duration-200 disabled:bg-slate-800 disabled:text-slate-500 cursor-pointer text-sm flex items-center justify-center gap-2"
                >
                  {loading ? 'Checking Routes...' : 'Generate Quote'}
                  <span className="text-[10px] bg-blue-800/60 text-blue-200 px-1.5 py-0.5 rounded font-mono hidden sm:inline">Ctrl+Enter</span>
                </button>

                <button
                  type="button"
                  onClick={() => dispatch({ type: 'RESET' })}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-xl border border-slate-700 transition duration-200 cursor-pointer text-sm"
                >
                  Reset
                </button>
              </div>
            </form>

            {/* Quote Results Section */}
            {quoteData && (
              <div ref={resultsRef} className="mt-6 border-t border-slate-800/80 pt-6">
                {mapUrl && (
                  <div className="mb-5 rounded-xl overflow-hidden border border-slate-800 shadow-xl bg-[#080c14]">
                    <iframe title="Route Map" width="100%" height="220" style={{ border: 0 }} loading="lazy" allowFullScreen src={mapUrl}></iframe>
                  </div>
                )}

                <div className="bg-gradient-to-b from-[#1a2233] to-[#101522] border border-blue-500/30 rounded-xl p-5 text-center shadow-xl mb-5 relative">
                  <div className="flex flex-wrap justify-center sm:justify-end gap-1 mb-2 sm:mb-0 sm:absolute sm:top-3 sm:right-3">
                    {quoteData.hasAfterHours && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border transition ${activeOverrides.afterHours ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-800/80 text-slate-500 border-slate-700 line-through'}`}>
                        +25% After Hours
                        <button type="button" onClick={() => dispatch({ type: 'TOGGLE_OVERRIDE', payload: 'afterHours' })} className="hover:text-white font-bold ml-0.5 cursor-pointer">
                          {activeOverrides.afterHours ? '✕' : '↺'}
                        </button>
                      </span>
                    )}

                    {quoteData.hasRoadClub && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border transition ${activeOverrides.roadClub ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-slate-800/80 text-slate-500 border-slate-700 line-through'}`}>
                        +15% Road Club
                        <button type="button" onClick={() => dispatch({ type: 'TOGGLE_OVERRIDE', payload: 'roadClub' })} className="hover:text-white font-bold ml-0.5 cursor-pointer">
                          {activeOverrides.roadClub ? '✕' : '↺'}
                        </button>
                      </span>
                    )}

                    {quoteData.hasMetroZone && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border transition ${activeOverrides.metro ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-slate-800/80 text-slate-500 border-slate-700 line-through'}`}>
                        +28.57% Metro
                        <button type="button" onClick={() => dispatch({ type: 'TOGGLE_OVERRIDE', payload: 'metro' })} className="hover:text-white font-bold ml-0.5 cursor-pointer">
                          {activeOverrides.metro ? '✕' : '↺'}
                        </button>
                      </span>
                    )}

                    {quoteData.hasHazardZone && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border transition ${activeOverrides.hazard ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-slate-800/80 text-slate-500 border-slate-700 line-through'}`}>
                        +40% Hazard Zone
                        <button type="button" onClick={() => dispatch({ type: 'TOGGLE_OVERRIDE', payload: 'hazard' })} className="hover:text-white font-bold ml-0.5 cursor-pointer">
                          {activeOverrides.hazard ? '✕' : '↺'}
                        </button>
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] uppercase tracking-widest font-bold text-blue-400">
                    Estimated Quote Range (${quoteData.isHeavy ? `${RATES.HEAVY_HOURLY_MIN} – $${RATES.HEAVY_HOURLY_MAX}` : `${RATES.HOURLY_MIN} – $${RATES.HOURLY_MAX}`}/hr)
                  </span>
                  <p className="text-3xl font-black text-white mt-1.5 tracking-tight">${currentMinQuote} – ${currentMaxQuote}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Rounded to nearest $25</p>

                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'TOGGLE_DETAILS' })}
                    className="mt-3 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4 cursor-pointer transition"
                  >
                    {showDetails ? '▲ Hide Trip Breakdown' : '▼ Show Trip Breakdown'}
                  </button>
                </div>

                {showDetails && (
                  <div className="bg-[#080c14] border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs mb-5 shadow-inner">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Route & Time Breakdown</h3>
                    {quoteData.legsDetails.map((leg, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                        <span>{leg.label}</span>
                        <span className="font-semibold text-slate-200">{leg.minutes} mins</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                      <span>Adjusted Drive Time (+10%)</span>
                      <span className="font-semibold text-slate-200">{quoteData.adjustedDriveMin} mins</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                      <span>Load / Unload Flat Rate</span>
                      <span className="font-semibold text-slate-200">{quoteData.loadUnloadTime} mins</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                      <span>Metro Zone Status</span>
                      <span className={`font-semibold ${quoteData.hasMetroZone && activeOverrides.metro ? 'text-purple-400' : 'text-slate-200'}`}>
                        {quoteData.hasMetroZone ? (activeOverrides.metro ? 'Applied (+28.57%)' : 'Removed (0%)') : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                      <span>Hazard Zone Status</span>
                      <span className={`font-semibold ${quoteData.hasHazardZone && activeOverrides.hazard ? 'text-red-400' : 'text-slate-200'}`}>
                        {quoteData.hasHazardZone ? (activeOverrides.hazard ? 'Applied (+40%)' : 'Removed (0%)') : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                      <span>Base Price Range (No Surcharges)</span>
                      <span className="font-semibold text-emerald-400">${quoteData.baseMinQuote} – ${quoteData.baseMaxQuote}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 text-sm font-bold text-white">
                      <span>Total Billable Hours</span>
                      <span className="text-blue-400">{quoteData.totalHours} hrs</span>
                    </div>
                  </div>
                )}

                <div className="bg-[#1a2130]/60 border border-slate-700/80 rounded-xl p-3.5 mb-5 shadow-md">
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-300 mb-1.5">Custom Hourly Rate</label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">$</span>
                      <input
                        type="number"
                        placeholder="Enter rate (e.g. 150)"
                        value={customRate}
                        onChange={(e) => dispatch({ type: 'SET_CUSTOM_RATE', payload: e.target.value })}
                        className="w-full bg-[#080c14] border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none text-sm"
                      />
                    </div>
                    {customCalculatedQuote !== null && (
                      <div className="bg-blue-600/20 border border-blue-500/40 rounded-lg px-3 py-1.5 text-right">
                        <span className="text-[9px] uppercase tracking-wider block text-blue-300 font-bold">Custom Quote</span>
                        <span className="text-lg font-extrabold text-white">${customCalculatedQuote}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#1a2130]/60 border border-slate-700/80 rounded-xl p-3.5 mb-2 space-y-2.5">
                  <span className="block text-[11px] uppercase tracking-wider font-semibold text-slate-300">Log Quote to Database (Optional)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={(e) => dispatch({ type: 'SET_CUSTOMER_INFO', payload: { field: 'customerName', value: e.target.value } })}
                      className="bg-[#080c14] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={customerPhone}
                      onChange={(e) => dispatch({ type: 'SET_CUSTOMER_INFO', payload: { field: 'customerPhone', value: e.target.value } })}
                      className="bg-[#080c14] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleLogQuote}
                    disabled={isSaving}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg transition disabled:bg-slate-800 cursor-pointer"
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