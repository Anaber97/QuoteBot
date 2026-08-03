// src/App.jsx
// @ts-check
import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import { SHOP_LOCATIONS } from './config/locations';
import { supabase } from './lib/supabase';
import { calculateQuoteData, calculateFinalQuotes } from './services/quoteCalculator';

import Header from './components/Header';
import SurchargeToggles from './components/SurchargeToggles';
import WaypointList from './components/WaypointList';
import QuoteResultsCard from './components/QuoteResultsCard';
import QuoteLog from './components/QuoteLog';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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
      return { ...initialState, isApiLoaded: state.isApiLoaded };
    default:
      return state;
  }
}

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
    customerName,
    customerPhone,
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

  // Load Google Maps SDK
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      dispatch({
        type: 'CALCULATE_ERROR',
        payload: 'Google Maps API key is missing. Please check configuration.',
      });
      return;
    }

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

  // Attach Autocomplete
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
        if (ref && ref.dataset) ref.dataset.autocompleteAttached = 'false';
      });
      instances.clear();
    };
  }, [isApiLoaded, activeTab, waypoints, handleWaypointChange]);

  const handleCalculate = async (e) => {
    if (e) e.preventDefault();

    const now = Date.now();
    if (now - lastCalculationTime.current < 2000) {
      dispatch({ type: 'CALCULATE_ERROR', payload: 'Please wait 2 seconds between calculation requests.' });
      return;
    }
    lastCalculationTime.current = now;

    dispatch({ type: 'CALCULATE_START' });

    try {
      const result = await calculateQuoteData({
        currentBase,
        waypoints,
        isHeavy,
        isAfterHours,
        isRoadClub,
        isMetro,
        isHazard,
      });

      dispatch({ type: 'CALCULATE_SUCCESS', payload: result });
    } catch (err) {
      console.error('Calculation error:', err);
      const message = err?.message?.includes('OVER_QUERY_LIMIT')
        ? 'Google Maps API limit exceeded. Please try again later.'
        : err?.message || 'An error occurred calculating the quote.';
      dispatch({ type: 'CALCULATE_ERROR', payload: message });
    }
  };

  const handleLogQuote = async () => {
    if (!quoteData) return;
    dispatch({ type: 'SAVE_START' });

    const { currentMinQuote, currentMaxQuote } = calculateFinalQuotes(quoteData, activeOverrides, customRate);

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

  // Keyboard Shortcuts
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

  // Smooth Scroll to Results
  useEffect(() => {
    if (quoteData && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [quoteData]);

  return (
    <div className="min-h-screen w-full bg-[#080c14] flex flex-col items-center justify-center p-4 sm:p-6 text-slate-200">
      <div className="w-full max-w-md sm:max-w-xl bg-[#121824] rounded-2xl shadow-2xl p-5 sm:p-8 border border-slate-800/80">
        
        <Header activeTab={activeTab} onSelectTab={(tab) => dispatch({ type: 'SET_TAB', payload: tab })} />

        {activeTab === 'log' ? (
          <QuoteLog onSelectQuote={(log) => dispatch({ type: 'LOAD_QUOTE_INTO_CALCULATOR', payload: log })} />
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
              <SurchargeToggles state={state} dispatch={dispatch} />

              <WaypointList
                waypoints={waypoints}
                inputRefs={inputRefs}
                onChange={handleWaypointChange}
                onRemove={handleRemoveWaypoint}
                onAdd={() => dispatch({ type: 'ADD_WAYPOINT' })}
              />

              <button
                type="submit"
                disabled={loading || !isApiLoaded}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-bold text-sm text-white rounded-xl transition shadow-lg disabled:bg-slate-800 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? 'Calculating Route...' : 'Calculate Quote'}
              </button>
            </form>

            <QuoteResultsCard
              state={state}
              dispatch={dispatch}
              resultsRef={resultsRef}
              onLogQuote={handleLogQuote}
            />
          </>
        )}
      </div>
    </div>
  );
}