// src/App.jsx
// @ts-check
import React, { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { SHOP_LOCATIONS } from './config/locations';
import { supabase } from './lib/supabase';
import { calculateQuoteData, calculateFinalQuotes } from './services/quoteCalculator';

import Header from './components/Header';
import LoginCard from './components/LoginCard';
import SurchargeToggles from './components/SurchargeToggles';
import WaypointList from './components/WaypointList';
import QuoteResultsCard from './components/QuoteResultsCard';
import QuoteLog from './components/QuoteLog';
import Settings, { DEFAULT_CONFIG } from './components/Settings';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Helper: Read personal default base from localStorage if saved
const getInitialBaseId = () => {
  const savedBase = localStorage.getItem('dispatch_default_base');
  if (savedBase && SHOP_LOCATIONS.some((b) => b.id === savedBase)) {
    return savedBase;
  }
  return SHOP_LOCATIONS[0].id;
};

const initialState = {
  activeTab: 'calculator',
  selectedBaseId: getInitialBaseId(),
  selectedTruckClassId: '',
  waypoints: ['', ''],
  isAfterHours: false,
  isRoadClub: false,
  isMetro: false,
  isHazard: false,
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
    case 'SET_TRUCK_CLASS':
      return { ...state, selectedTruckClassId: action.payload };
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
  const [userProfile, setUserProfile] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const {
    activeTab,
    selectedBaseId,
    selectedTruckClassId,
    waypoints,
    isAfterHours,
    isRoadClub,
    isMetro,
    isHazard,
    customerName,
    customerPhone,
    customRate,
    isApiLoaded,
    loading,
    error,
    quoteData,
  } = state;

  // Check active Supabase Auth session on load
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) setUserProfile(profile);
        }
      } catch (err) {
        console.error('Auth verification error:', err);
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserProfile(null);
      } else if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profile) setUserProfile(profile);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Persistent Base Selection handler
  const handleBaseChange = (baseId) => {
    localStorage.setItem('dispatch_default_base', baseId);
    dispatch({ type: 'SET_BASE', payload: baseId });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
  };

  const currentBase = SHOP_LOCATIONS.find((b) => b.id === selectedBaseId) || SHOP_LOCATIONS[0];
  const inputRefs = useRef([]);
  const autocompleteInstances = useRef(new Map());
  const lastCalculationTime = useRef(0);
  const resultsRef = useRef(null);

  // Load Google Maps SDK
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      dispatch({ type: 'CALCULATE_ERROR', payload: 'Google Maps API key is missing.' });
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
    if (!isApiLoaded || activeTab !== 'calculator' || !userProfile) return;

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
  }, [isApiLoaded, activeTab, waypoints, userProfile, handleWaypointChange]);

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
      const effectiveWaypoints = waypoints.filter((w) => w.trim().length > 0);
      if (effectiveWaypoints.length === 1) {
        effectiveWaypoints.push(effectiveWaypoints[0]);
      }

      // Dynamic rate resolution based on selected truck class
      let selectedClassMinRate = null;
      let selectedClassMaxRate = null;
      if (selectedTruckClassId) {
        const matchedClass = DEFAULT_CONFIG.pricing.custom_truck_classes.find(tc => tc.id === selectedTruckClassId);
        if (matchedClass) {
          selectedClassMinRate = matchedClass.minRate;
          selectedClassMaxRate = matchedClass.maxRate;
        }
      }

      const result = await calculateQuoteData({
        currentBase,
        waypoints: effectiveWaypoints,
        isAfterHours,
        isRoadClub,
        isMetro,
        isHazard,
        overrideMinRate: selectedClassMinRate,
        overrideMaxRate: selectedClassMaxRate,
      });

      dispatch({ type: 'CALCULATE_SUCCESS', payload: result });
    } catch (err) {
      console.error('Calculation error:', err);
      dispatch({ type: 'CALCULATE_ERROR', payload: err?.message || 'Calculation error.' });
    }
  };

  const handleLogQuote = async () => {
    if (!quoteData) return;
    dispatch({ type: 'SAVE_START' });

    const { currentMinQuote, currentMaxQuote } = calculateFinalQuotes(quoteData, state.activeOverrides, customRate);

    const activeModifiers = [];
    if (quoteData.hasAfterHours && state.activeOverrides.afterHours) activeModifiers.push('+25% After Hours');
    if (quoteData.hasRoadClub && state.activeOverrides.roadClub) activeModifiers.push('+15% Road Club');
    if (quoteData.hasMetroZone && state.activeOverrides.metro) activeModifiers.push('+28.57% Metro');
    if (quoteData.hasHazardZone && state.activeOverrides.hazard) activeModifiers.push('+40% Hazard Zone');

    const { error } = await supabase.from('quotes').insert([
      {
        company_id: userProfile?.company_id,
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

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center text-slate-400 text-xs">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-3" />
        <p>Verifying Auth Workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#080c14] flex flex-col items-center justify-start pt-6 sm:pt-10 pb-12 p-4 sm:p-6 text-slate-200 transition-all">
      <div className="w-full max-w-5xl bg-[#121824] rounded-2xl shadow-2xl p-5 sm:p-8 border border-slate-800/80 transition-all">
        
        <Header
          activeTab={activeTab}
          onSelectTab={(tab) => dispatch({ type: 'SET_TAB', payload: tab })}
          profile={userProfile}
          onSignOut={handleSignOut}
        />

        {!userProfile ? (
          <LoginCard onAuthSuccess={(profile) => setUserProfile(profile)} />
        ) : (
          <>
            {activeTab === 'log' && userProfile.role !== 'client' && (
              <QuoteLog onSelectQuote={(log) => dispatch({ type: 'LOAD_QUOTE_INTO_CALCULATOR', payload: log })} />
            )}

            {activeTab === 'settings' && userProfile.role === 'manager' && (
              <Settings
                currentUserRole={userProfile.role}
                onSaveConfig={async (newConfig) => {
                  const { error } = await supabase.from('app_config').upsert(newConfig);
                  if (error) throw error;
                }}
              />
            )}

            {activeTab === 'calculator' && (
              <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
                <div className="lg:col-span-7 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="baseShopSelect" className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                        Base Location
                      </label>
                      <select
                        id="baseShopSelect"
                        value={selectedBaseId}
                        onChange={(e) => handleBaseChange(e.target.value)}
                        className="bg-[#1a2130] border border-slate-700/80 text-white text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full"
                      >
                        {SHOP_LOCATIONS.map((shop) => (
                          <option key={shop.id} value={shop.id}>
                            {shop.name} ({shop.address})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="truckClassSelect" className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                        Truck / Equipment Class
                      </label>
                      <select
                        id="truckClassSelect"
                        value={selectedTruckClassId}
                        onChange={(e) => dispatch({ type: 'SET_TRUCK_CLASS', payload: e.target.value })}
                        className="bg-[#1a2130] border border-slate-700/80 text-white text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full"
                      >
                        <option value="">Standard Rate ($125 - $135/hr)</option>
                        {DEFAULT_CONFIG.pricing.custom_truck_classes.map((tc) => (
                          <option key={tc.id} value={tc.id}>
                            {tc.name} (${tc.minRate} - ${tc.maxRate}/hr)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs font-medium">
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
                </div>

                <div className="lg:col-span-5 mt-6 lg:mt-0">
                  {quoteData ? (
                    <QuoteResultsCard
                      state={state}
                      dispatch={dispatch}
                      resultsRef={resultsRef}
                      onLogQuote={handleLogQuote}
                    />
                  ) : (
                    <div className="hidden lg:flex flex-col items-center justify-center p-8 bg-[#080c14] border border-dashed border-slate-800 rounded-2xl min-h-[380px] text-center text-slate-500 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xl font-bold">
                        $
                      </div>
                      <h4 className="text-sm font-bold text-slate-300">Quote Breakdown Preview</h4>
                      <p className="text-xs max-w-xs">
                        Enter pick-up/drop-off locations and click <strong className="text-blue-400">Calculate Quote</strong> to display live route estimates here.
                      </p>
                    </div>
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