// src/App.jsx

// @ts-check
import React, { lazy, Suspense, useReducer, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { authenticatedFetch } from './lib/api';
import { calculateQuoteData } from './services/quoteCalculator';
import { normalizeConfig, DEFAULT_CONFIG } from './lib/configSchema';

import Header from './components/Header';
import LoginCard from './components/LoginCard';
import SurchargeToggles from './components/SurchargeToggles';
import WaypointList from './components/WaypointList';
import QuoteResultsCard from './components/QuoteResultsCard';
import Settings from './components/Settings';
import Toast from './components/Toast';
import Footer from './components/Footer';
import LegalPage from './components/LegalPage';

const QuoteLog = lazy(() => import('./components/QuoteLog'));
const InviteRegister = lazy(() => import('./components/InviteRegister'));
const ClientQuoteForm = lazy(() => import('./components/ClientQuoteForm'));
const LoadingPanel = () => <div className="p-8 text-center text-sm text-slate-400" role="status">Loading…</div>;

const getInitialBaseId = () => {
  const savedBase = localStorage.getItem('dispatch_default_base');
  return savedBase || '';
};

const normalizeCompanyConfig = (rawConfig = {}) => normalizeConfig(rawConfig);

const initialState = {
  activeTab: 'calculator',
  selectedBaseId: getInitialBaseId(),
  selectedTruckClassId: '',
  waypoints: ['', ''],
  isAfterHours: false,
  isRoadClub: false,
  isMetro: false,
  isHazard: false,
  activeOverrides: { afterHours: true, roadClub: true, metro: true, hazard: true, customSurcharges: {} },
  pendingCustomSurcharges: {},
  showDetails: false,
  customerName: '',
  customerPhone: '',
  quoteMake: '',
  quoteModel: '',
  quoteNotes: '',
  customRateInput: '',
  customLoadUnloadMins: '',
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_BASE':
      return { ...state, selectedBaseId: action.payload };
    case 'SET_TRUCK_CLASS':
      return { ...state, selectedTruckClassId: action.payload };
    case 'SET_WAYPOINTS':
      return { ...state, waypoints: Array.isArray(action.payload) ? action.payload : ['', ''] };
    case 'UPDATE_WAYPOINT': {
      const currentWaypoints = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
      const next = [...currentWaypoints];
      next[action.payload.index] = action.payload.value;
      return { ...state, waypoints: next };
    }
    case 'ADD_WAYPOINT': {
      const currentWaypoints = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
      return { ...state, waypoints: [...currentWaypoints, ''] };
    }
    case 'REMOVE_WAYPOINT': {
      const currentWaypoints = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
      if (currentWaypoints.length <= 2) return state;
      const next = currentWaypoints.filter((_, idx) => idx !== action.payload);
      return { ...state, waypoints: next };
    }
    case 'TOGGLE_SURCHARGE':
      return { ...state, [action.payload]: !state[action.payload] };
    case 'SET_OVERRIDE':
      return {
        ...state,
        activeOverrides: {
          ...state.activeOverrides,
          [action.payload.key]: action.payload.value,
        },
      };
    case 'TOGGLE_DETAILS':
      return { ...state, showDetails: !state.showDetails };
    case 'SET_CUSTOMER_INFO':
      return { ...state, [action.payload.field]: action.payload.value };
    case 'SET_QUOTE_META_FIELDS':
      return { ...state, ...action.payload };
    case 'SET_CUSTOM_RATE':
      return { ...state, customRateInput: action.payload };
    case 'SET_CUSTOM_LOAD_UNLOAD':
      return { ...state, customLoadUnloadMins: action.payload };
    case 'SET_PENDING_CUSTOM_SURCHARGES':
      return { ...state, pendingCustomSurcharges: action.payload };
    case 'LOAD_LOGGED_QUOTE':
      return {
        ...state,
        activeTab: 'calculator',
        selectedBaseId: action.payload.base_yard_id || '',
        selectedTruckClassId: action.payload.truck_class || '',
        waypoints: Array.isArray(action.payload.all_waypoints) && action.payload.all_waypoints.length >= 2
          ? action.payload.all_waypoints
          : [action.payload.pickup_address || '', action.payload.dropoff_address || ''],
        customerName: action.payload.customer_name || '',
        customerPhone: action.payload.customer_phone || '',
        quoteMake: action.payload.quote_details?.make || '',
        quoteModel: action.payload.quote_details?.model || '',
        quoteNotes: action.payload.notes || '',
      };
    case 'RESET_FORM':
      return {
        ...initialState,
        waypoints: ['', ''],
        activeTab: state.activeTab,
        selectedBaseId: state.selectedBaseId,
      };
    default:
      return state;
  }
}

export default function App() {
  const legalRoute = window.location.pathname.replace(/\/+$/, '') || '/';
  const [notice, setNotice] = useState(null);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [theme, setTheme] = useState(() => localStorage.getItem('towcalc_theme') || 'dark');
  const [isInviteRoute, setIsInviteRoute] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [companyRates, setCompanyRates] = useState(() => normalizeCompanyConfig(DEFAULT_CONFIG));

  const [loading, setLoading] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [showEquipmentCalculator, setShowEquipmentCalculator] = useState(false);
  const [openedLoggedQuote, setOpenedLoggedQuote] = useState(null);
  const [error, setError] = useState(null);
  const [profileLoadError, setProfileLoadError] = useState(null);
  const currentAuthUserIdRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('towcalc_theme', theme);
  }, [theme]);

  const resetCalculatorState = () => {
    dispatch({ type: 'RESET_FORM' });
    setQuoteData(null);
    setOpenedLoggedQuote(null);
    setError(null);
    setLoading(false);
  };

  const handleOpenLoggedQuote = (loggedQuote) => {
    dispatch({ type: 'LOAD_LOGGED_QUOTE', payload: loggedQuote });
    setQuoteData(null);
    setOpenedLoggedQuote(loggedQuote);
    setShowEquipmentCalculator(['client_portal', 'equipment_calculator'].includes(loggedQuote.quote_source));
  };

  const handleSignOut = async () => {
    resetCalculatorState();
    await supabase.auth.signOut();
  };

  const getActiveClientConfig = (activeProfile = profile, activeRates = companyRates) => {
    if (!activeProfile || !activeRates?.client_portal?.clients?.length) return null;

    const profileEmail = String(activeProfile.email || '').trim().toLowerCase();
    const profileName = String(activeProfile.full_name || activeProfile.client_name || activeProfile.name || '').trim().toLowerCase();

    return (activeRates.client_portal.clients || []).find((client) => {
      if (activeProfile.client_id && client.id === activeProfile.client_id) return true;
      const clientEmail = String(client.contact_email || '').trim().toLowerCase();
      const clientName = String(client.client_name || '').trim().toLowerCase();
      return (profileEmail && clientEmail && profileEmail === clientEmail) || (profileName && clientName && profileName === clientName);
    }) || null;
  };

  const resultsRef = useRef(null);

  const userRole = (profile?.role || '').toLowerCase().trim();
  const isClientPortalUser = userRole === 'client';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsInviteRoute(Boolean(params.get('invite')));
  }, []);

  // 1. Auth Session listener & app_config loader
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const nextUserId = session?.user?.id || null;
      currentAuthUserIdRef.current = nextUserId;
      if (nextUserId) {
        resetCalculatorState();
        fetchProfileAndRates(nextUserId);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id || null;
      const previousUserId = currentAuthUserIdRef.current;
      const didAuthIdentityChange = previousUserId !== nextUserId;

      if (didAuthIdentityChange) {
        resetCalculatorState();
      }

      currentAuthUserIdRef.current = nextUserId;
      setSession(session);
      if (session?.user) fetchProfileAndRates(session.user.id);
      else {
        setProfile(null);
        setCompanyRates(normalizeCompanyConfig(DEFAULT_CONFIG));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfileAndRates = async (userId) => {
    setProfileLoadError(null);
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profErr) throw profErr;
      setProfile(prof);

      if (prof?.company_id) {
        let loadedConfig = null;

        try {
          const params = new URLSearchParams({ company_id: String(prof.company_id) });
          const response = await authenticatedFetch(`/api/getAppConfig?${params.toString()}`);
          const result = await response.json().catch(() => ({}));

          if (response.ok && result?.config) {
            loadedConfig = result.config;
          }
        } catch (apiErr) {
          console.warn('Server app_config fetch fallback triggered:', apiErr);
        }

        if (!loadedConfig) {
          const { data: ratesData, error: ratesErr } = await supabase
            .from('app_config')
            .select('*')
            .eq('company_id', prof.company_id)
            .maybeSingle();

          if (!ratesErr && ratesData) {
            loadedConfig = ratesData;
          }
        }

        if (loadedConfig) {
          const { data: clientAccounts, error: clientAccountsError } = await supabase
            .from('clients')
            .select('id, company_id, client_name, contact_email, contact_phone, approval_threshold, pricing, logo_path')
            .eq('company_id', prof.company_id);
          if (!clientAccountsError) {
            loadedConfig = {
              ...loadedConfig,
              client_portal: {
                ...(loadedConfig.client_portal || {}),
                clients: clientAccounts || [],
              },
            };
          }
          setCompanyRates(normalizeCompanyConfig(loadedConfig));
        }
      }
    } catch (err) {
      console.error('Error fetching profile or rates:', err);
      // Never leave a stale profile/config from a previous identity in place
      // when the load for the *current* user fails.
      setProfile(null);
      setCompanyRates(normalizeCompanyConfig(DEFAULT_CONFIG));
      setProfileLoadError('We could not load your account profile. Please refresh the page or sign in again.');
    }
  };

  const handleSettingsSave = (newConfig) => {
    setCompanyRates(normalizeCompanyConfig(newConfig));
    setQuoteData(null);
    setOpenedLoggedQuote(null);
  };

  // Base Shops (Uses database app_config bases if available)
  const availableBases = Array.isArray(companyRates?.bases) ? companyRates.bases : [];

  const currentBase =
    availableBases.find((b) => b.id === state.selectedBaseId) || availableBases[0];

  // Dynamic Truck Classes from app_config
  const customClasses = companyRates?.pricing?.custom_truck_classes || [];

  // Dispatcher Quote Handler
  const handleCalculate = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const waypointsArr = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
      const cleanWaypoints = waypointsArr.map((w) => w.trim()).filter(Boolean);

      if (cleanWaypoints.length < 1) {
        throw new Error('Please enter a Pick-up location.');
      }
      if (!currentBase?.address) {
        throw new Error('Add a Base Yard in Settings before calculating a quote.');
      }

      const data = await calculateQuoteData({
        currentBase,
        waypoints: cleanWaypoints.length === 1 ? [cleanWaypoints[0], cleanWaypoints[0]] : cleanWaypoints,
        selectedTruckClassId: state.selectedTruckClassId,
        isHeavy: state.selectedTruckClassId === 'heavy' || state.selectedTruckClassId === '3',
        isAfterHours: state.isAfterHours,
        isRoadClub: state.isRoadClub,
        isMetro: state.isMetro,
        isHazard: state.isHazard,
        companyRates,
      });

      setQuoteData({ ...data, appliedCustomSurcharges: state.pendingCustomSurcharges });
      dispatch({ type: 'SET_OVERRIDE', payload: { key: 'customSurcharges', value: { ...state.pendingCustomSurcharges } } });

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error calculating quote. Check addresses or API keys.');
    } finally {
      setLoading(false);
    }
  };

  // Client Portal Quote Handler
  const handleClientCalculateQuote = async (clientPayload) => {
    const {
      pickupAddr,
      dropoffAddr,
      weight,
      width,
      height,
      equipmentName,
      make,
      model,
      serialNumber,
      permitInfo,
      attachmentType,
      attachmentWeight,
      waypoints: clientWaypoints,
    } = clientPayload;

    const routeWaypoints = Array.isArray(clientWaypoints) && clientWaypoints.length >= 2
      ? clientWaypoints
      : [pickupAddr, dropoffAddr];
    dispatch({ type: 'SET_WAYPOINTS', payload: routeWaypoints });

    const isHeavy = weight > 45000 || width > 8.5 || height > 13.5;

    setLoading(true);
    setError(null);

    try {
      const activeClientConfig = getActiveClientConfig(profile, companyRates);
      dispatch({ type: 'SET_QUOTE_META_FIELDS', payload: { quoteMake: make || '', quoteModel: model || '' } });
      const data = await calculateQuoteData({
        currentBase,
        waypoints: routeWaypoints,
        selectedTruckClassId: isHeavy ? 'heavy' : state.selectedTruckClassId,
        isHeavy,
        isAfterHours: false,
        isRoadClub: false,
        isMetro: state.isMetro,
        isHazard: state.isHazard,
        companyRates,
        clientWeight: Number(weight) + Number(attachmentWeight || 0),
        equipmentWidth: Number(width || 0),
        equipmentHeight: Number(height || 0),
        clientConfig: activeClientConfig,
        useWeightTierPricing: true,
      });

      const permitFee = Number(permitInfo?.permitFee || 0);

      setQuoteData({
        ...data,
        permitFee,
        equipmentMeta: {
          name: equipmentName,
          make: make || '',
          model: model || '',
          serialNumber: serialNumber || '',
          weight,
          width,
          height,
          permitFee,
          permitFlags: permitInfo?.flags || [],
          attachmentType,
          attachmentWeight: Number(attachmentWeight || 0),
        },
      });

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error calculating quote. Check addresses or API keys.');
    } finally {
      setLoading(false);
    }
  };

  // Log Quote Handler
  const handleLogQuote = async ({ attachmentFile = null } = {}) => {
    if (!session || !profile || !quoteData) return;

    try {
      const waypointsArr = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
      const response = await authenticatedFetch('/api/createQuote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseId: state.selectedBaseId,
          waypoints: waypointsArr,
          quoteSource: showEquipmentCalculator ? 'equipment_calculator' : 'main_calculator',
          selectedTruckClassId: state.selectedTruckClassId,
          isHeavy: quoteData.isHeavy,
          isAfterHours: quoteData.hasAfterHours,
          isRoadClub: quoteData.hasRoadClub,
          activeOverrides: state.activeOverrides,
          customRate: state.customRateInput,
          customLoadUnloadMins: state.customLoadUnloadMins,
          customerName: state.customerName,
          customerPhone: state.customerPhone,
          notes: state.quoteNotes,
          equipment: {
            ...(quoteData.equipmentMeta || {}),
            make: state.quoteMake || quoteData.equipmentMeta?.make || '',
            model: state.quoteModel || quoteData.equipmentMeta?.model || '',
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.quote) throw new Error(result.error || 'The authoritative quote could not be saved.');
      const loggedQuote = result.quote;

      if (attachmentFile) {
        const safeName = attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const bolPath = `${profile.company_id}/${loggedQuote.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('quote-bols').upload(bolPath, attachmentFile, { contentType: attachmentFile.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: updateError } = await supabase.from('quote_logs').update({ bol_path: bolPath, bol_name: attachmentFile.name, bol_type: attachmentFile.type }).eq('id', loggedQuote.id);
        if (updateError) throw updateError;
      }

      const warning = result.notificationWarning ? ` ${result.notificationWarning}` : '';
      setNotice({ message: `${attachmentFile ? 'Quote logged with BOL attached!' : 'Quote successfully logged!'}${warning}` });
      dispatch({ type: 'RESET_FORM' });
      setQuoteData(null);
    } catch (err) {
      console.error(err);
      setNotice({ tone: 'error', message: `Failed to log quote: ${err.message}` });
    }
  };

  if (legalRoute === '/privacy') return <LegalPage type="privacy" />;
  if (legalRoute === '/terms') return <LegalPage type="terms" />;

  if (isInviteRoute) {
    return <div className="flex min-h-screen flex-col bg-[#080c14]"><Suspense fallback={<LoadingPanel />}><InviteRegister /></Suspense><Footer /></div>;
  }

  return (
    <div className="app-shell flex min-h-screen flex-col bg-[#080c14] text-slate-100 font-sans overflow-x-hidden">
      <Header
        session={session}
        profile={profile}
        activeTab={state.activeTab}
        setActiveTab={(tab) => dispatch({ type: 'SET_TAB', payload: tab })}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      />

      <div className="mx-auto w-full max-w-7xl flex-1 px-3 pb-12 pt-4 sm:px-6 sm:pt-6">
        {!session ? (
          <div className="py-12">
            <LoginCard />
          </div>
        ) : (
          <>
            {profileLoadError && (
              <div role="alert" className="mb-4 rounded-lg border border-red-800/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {profileLoadError}
              </div>
            )}
            {state.activeTab === 'logs' && <Suspense fallback={<LoadingPanel />}><QuoteLog profile={profile} onSelectQuote={handleOpenLoggedQuote} /></Suspense>}

            {state.activeTab === 'settings' && (
              <Settings
                profile={profile}
                currentUserRole={profile?.role || 'manager'}
                config={companyRates}
                onSaveConfig={handleSettingsSave}
              />
            )}

            {state.activeTab === 'calculator' && (
              isClientPortalUser ? (
                /* CLIENT PORTAL VIEW */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-7">
                    <Suspense fallback={<LoadingPanel />}><ClientQuoteForm
                      companyRates={companyRates}
                      onCalculate={handleClientCalculateQuote}
                      isCalculating={loading}
                      initialQuote={openedLoggedQuote}
                      client={getActiveClientConfig()}
                    /></Suspense>
                  </div>

                  <div className="lg:col-span-5">
                    {quoteData ? (
                      <QuoteResultsCard
                        state={{
                          ...state,
                          activeOverrides: state.activeOverrides,
                          quoteData,
                          customRate: state.customRateInput,
                        }}
                        dispatch={dispatch}
                        resultsRef={resultsRef}
                        onLogQuote={handleLogQuote}
                        companyRates={companyRates}
                        isDispatcherView={false}
                      />
                    ) : (
                      <div className="hidden lg:flex flex-col items-center justify-center p-8 bg-[#080c14] border border-dashed border-slate-800 rounded-2xl min-h-[380px] text-center text-slate-500 space-y-2">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xl font-bold">
                          $
                        </div>
                        <h4 className="text-sm font-bold text-slate-300">Quote Estimate</h4>
                        <p className="text-xs max-w-xs">
                          Search your equipment and enter pickup/dropoff locations to view an instant transport quote.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* DISPATCHER / MANAGER CALCULATOR VIEW */
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-7 bg-[#121824] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6 min-w-0">
                    <div className="border-b border-slate-800/80 pb-4">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-bold text-white tracking-tight">{showEquipmentCalculator ? 'Equipment Calculator' : 'Quote Generator'}</h2>
                        <button type="button" onClick={() => { setShowEquipmentCalculator((current) => !current); setQuoteData(null); setError(null); }} className="rounded-lg border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/10">
                          {showEquipmentCalculator ? 'Back to Main Calculator' : 'Open Equipment Calculator'}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-xs font-medium">
                        {error}
                      </div>
                    )}

                    {showEquipmentCalculator ? (
                      <Suspense fallback={<LoadingPanel />}><ClientQuoteForm companyRates={companyRates} onCalculate={handleClientCalculateQuote} isCalculating={loading} title="Equipment Calculator" onReset={resetCalculatorState} initialQuote={openedLoggedQuote} /></Suspense>
                    ) : <form onSubmit={handleCalculate} className="space-y-5">
                      {/* Base Shop Selector */}
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Base Dispatch Location
                        </label>
                        <select
                          value={state.selectedBaseId}
                          onChange={(e) => dispatch({ type: 'SET_BASE', payload: e.target.value })}
                          className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {availableBases.length === 0 && <option value="">Add a base yard in Settings</option>}
                          {availableBases.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name} ({loc.address})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Tow Vehicle / Class Selector */}
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Tow Vehicle Class
                        </label>
                        <select
                          value={state.selectedTruckClassId}
                          onChange={(e) => dispatch({ type: 'SET_TRUCK_CLASS', payload: e.target.value })}
                          className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="">
                            Standard Tow / Flatbed (${companyRates?.pricing?.hourly_min || 125}/hr)
                          </option>
                          {customClasses.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name} (${cls.minRate}/hr)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[13px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Route Waypoints
                        </label>
                        <WaypointList
                          waypoints={Array.isArray(state.waypoints) ? state.waypoints : ['', '']}
                          inputRefs={{ current: [] }}
                          onChange={(index, value) =>
                            dispatch({ type: 'UPDATE_WAYPOINT', payload: { index, value } })
                          }
                          onRemove={(index) => dispatch({ type: 'REMOVE_WAYPOINT', payload: index })}
                          onAdd={() => dispatch({ type: 'ADD_WAYPOINT' })}
                          onReset={resetCalculatorState}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Manual Surcharge Overrides
                        </label>
                        <SurchargeToggles state={state} dispatch={dispatch} companyRates={companyRates} />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-bold text-xs text-white rounded-xl transition cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? 'Calculating Route...' : 'Calculate Quote'}
                      </button>
                    </form>}
                    </div>

                    <div className="lg:col-span-5 mt-6 lg:mt-0">
                      {quoteData ? (
                        <QuoteResultsCard
                          state={{
                            ...state,
                            activeOverrides: state.activeOverrides,
                            quoteData,
                            customRate: state.customRateInput,
                          }}
                          dispatch={dispatch}
                          resultsRef={resultsRef}
                          onLogQuote={handleLogQuote}
                          companyRates={companyRates}
                          isDispatcherView={true}
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

                  <div className="mt-10 border-t border-slate-800/70 pt-5 text-center">
                    <p className="text-[11px] text-slate-500">
                      Quotes are electronically generated estimates and may contain occasional inaccuracies. Final pricing should be confirmed before dispatch.
                    </p>
                  </div>
                </>
              )
            )}
          </>
        )}
      </div>
      <Footer />
      <Toast notice={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
}
