// src/App.jsx

// @ts-check
import React, { useReducer, useEffect, useRef, useState } from 'react';
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
import InviteRegister from './components/InviteRegister';
import ClientQuoteForm from './components/ClientQuoteForm';

const getInitialBaseId = () => {
  const savedBase = localStorage.getItem('dispatch_default_base');
  if (savedBase && SHOP_LOCATIONS.some((b) => b.id === savedBase)) {
    return savedBase;
  }
  return SHOP_LOCATIONS[0].id;
};

const normalizeDriveTimeBuffer = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 10;
  if (num > 1.5) return num;
  if (num > 0) return (num - 1) * 100;
  return 10;
};

const normalizeCompanyConfig = (config = {}) => ({
  ...DEFAULT_CONFIG,
  ...config,
  company_id: config.company_id || DEFAULT_CONFIG.company_id,
  pricing: {
    ...(DEFAULT_CONFIG.pricing || {}),
    ...(config.pricing || {}),
    rounding_interval: Number(
      config.pricing?.rounding_interval ?? config.rounding_interval ?? DEFAULT_CONFIG.pricing.rounding_interval
    ) || 25,
    hourly_min: Number(config.pricing?.hourly_min ?? config.hourly_min ?? DEFAULT_CONFIG.pricing.hourly_min) || 125,
    hourly_max: Number(config.pricing?.hourly_max ?? config.hourly_max ?? DEFAULT_CONFIG.pricing.hourly_max) || 135,
    drive_time_buffer: normalizeDriveTimeBuffer(config.pricing?.drive_time_buffer ?? config.drive_time_buffer ?? DEFAULT_CONFIG.pricing.drive_time_buffer),
    load_unload_base_mins: Number(config.pricing?.load_unload_base_mins ?? config.load_unload_base_mins ?? DEFAULT_CONFIG.pricing.load_unload_base_mins) || 30,
    extra_stop_mins: Number(config.pricing?.extra_stop_mins ?? config.extra_stop_mins ?? DEFAULT_CONFIG.pricing.extra_stop_mins) || 15,
  },
  surcharges: {
    ...(DEFAULT_CONFIG.surcharges || {}),
    ...(config.surcharges || {}),
  },
  geofences: {
    disabledZones: config.geofences?.disabledZones || [],
    customZoneRates: config.geofences?.customZoneRates || {},
    customZones: Array.isArray(config.geofences?.customZones) ? config.geofences.customZones : [],
  },
  bases: Array.isArray(config.bases) && config.bases.length > 0 ? config.bases : DEFAULT_CONFIG.bases,
  users: Array.isArray(config.users) ? config.users.filter(Boolean) : [],
  client_portal: {
    ...(DEFAULT_CONFIG.client_portal || {}),
    ...(config.client_portal || {}),
    clients: Array.isArray(config.client_portal?.clients)
      ? config.client_portal.clients.map((client) => ({
          ...client,
          pricing: client.pricing || {},
        }))
      : [],
  },
});

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
  customRateInput: '',
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
    case 'SET_CUSTOM_RATE':
      return { ...state, customRateInput: action.payload };
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
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isInviteRoute, setIsInviteRoute] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [companyRates, setCompanyRates] = useState(() => normalizeCompanyConfig(DEFAULT_CONFIG));

  const [loading, setLoading] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [error, setError] = useState(null);
  const currentAuthUserIdRef = useRef(null);

  const resetCalculatorState = () => {
    dispatch({ type: 'RESET_FORM' });
    setQuoteData(null);
    setError(null);
    setLoading(false);
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
      const clientEmail = String(client.contact_email || '').trim().toLowerCase();
      const clientName = String(client.client_name || '').trim().toLowerCase();
      return (profileEmail && clientEmail && profileEmail === clientEmail) || (profileName && clientName && profileName === clientName);
    }) || null;
  };

  const resultsRef = useRef(null);

  const userRole = (profile?.role || '').toLowerCase().trim();
  const isClientPortalUser = userRole === 'client';
  const isManagerRole = userRole === 'manager';

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
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profErr) throw profErr;
      setProfile(prof);

      if (prof?.company_id) {
        const { data: ratesData, error: ratesErr } = await supabase
          .from('app_config')
          .select('*')
          .eq('company_id', prof.company_id)
          .maybeSingle();

        if (!ratesErr && ratesData) {
          setCompanyRates(normalizeCompanyConfig(ratesData));
        }
      }
    } catch (err) {
      console.error('Error fetching profile or rates:', err);
    }
  };

  const handleSettingsSave = (newConfig) => {
    setCompanyRates(normalizeCompanyConfig(newConfig));
  };

  // Base Shops (Uses database app_config bases if available)
  const availableBases = Array.isArray(companyRates?.bases) && companyRates.bases.length > 0
    ? companyRates.bases
    : SHOP_LOCATIONS;

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

      if (cleanWaypoints.length < 2) {
        throw new Error('Please enter at least a Pick-up and Drop-off location.');
      }

      const data = await calculateQuoteData({
        currentBase,
        waypoints: cleanWaypoints,
        selectedTruckClassId: state.selectedTruckClassId,
        isHeavy: state.selectedTruckClassId === 'heavy' || state.selectedTruckClassId === '3',
        isAfterHours: state.isAfterHours,
        isRoadClub: state.isRoadClub,
        isMetro: state.isMetro,
        isHazard: state.isHazard,
        companyRates,
      });

      setQuoteData(data);

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
    } = clientPayload;

    dispatch({ type: 'SET_WAYPOINTS', payload: [pickupAddr, dropoffAddr] });

    const isHeavy = weight > 45000 || width > 8.5 || height > 13.5;

    setLoading(true);
    setError(null);

    try {
      const activeClientConfig = getActiveClientConfig(profile, companyRates);
      const data = await calculateQuoteData({
        currentBase,
        waypoints: [pickupAddr, dropoffAddr],
        selectedTruckClassId: isHeavy ? 'heavy' : state.selectedTruckClassId,
        isHeavy,
        isAfterHours: false,
        isRoadClub: false,
        isMetro: state.isMetro,
        isHazard: state.isHazard,
        companyRates,
        clientWeight: Number(weight) + Number(attachmentWeight || 0),
        clientConfig: activeClientConfig,
      });

      const permitFee = Number(permitInfo?.permitFee || 0);

      if (data.approvalRequired) {
        try {
          await fetch('/api/notifyApproval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyName: profile?.company_name || 'your company',
              email: companyRates?.client_portal?.contact_email || profile?.email || '',
              equipmentName: equipmentName || 'Custom Load',
              make: make || '',
              model: model || '',
              serialNumber: serialNumber || '',
              weight: Number(weight) + Number(attachmentWeight || 0),
              pickupAddr,
              dropoffAddr,
              contactPhone: state.customerPhone || companyRates?.client_portal?.contact_phone || '(555) 555-0199',
              contactEmail: profile?.email || companyRates?.client_portal?.contact_email || 'quotes@yourcompany.com',
              quoteAmount: data.baseMinQuote,
              quoteRange: `${data.baseMinQuote} - ${data.baseMaxQuote}`,
              permitFlags: permitInfo?.flags || [],
              attachmentTypeLabel: attachmentType || '',
              attachmentWeight: Number(attachmentWeight || 0),
            }),
          });
        } catch (approvalErr) {
          console.warn('Approval email notification could not be sent:', approvalErr);
        }
      }

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
  const handleLogQuote = async () => {
    if (!session || !profile) return;

    try {
      const { currentMinQuote, currentMaxQuote, customCalculatedQuote } = calculateFinalQuotes(
        quoteData,
        state.activeOverrides,
        parseFloat(state.customRateInput) || null,
        companyRates
      );

      const waypointsArr = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];

      const payload = {
        company_id: profile.company_id,
        user_id: session.user.id,
        customer_name: state.customerName,
        customer_phone: state.customerPhone,
        pickup_address: waypointsArr[0] || '',
        dropoff_address: waypointsArr[waypointsArr.length - 1] || '',
        all_waypoints: waypointsArr,
        base_yard_id: state.selectedBaseId,
        truck_class: state.selectedTruckClassId,
        total_miles: quoteData.totalMiles,
        total_hours: quoteData.rawTotalHours,
        min_quote: currentMinQuote,
        max_quote: currentMaxQuote,
        custom_quote: customCalculatedQuote,
        applied_surcharges: {
          afterHours: quoteData.hasAfterHours && state.activeOverrides.afterHours,
          roadClub: quoteData.hasRoadClub && state.activeOverrides.roadClub,
          metro: quoteData.hasMetroZone && state.activeOverrides.metro,
          hazard: quoteData.hasHazardZone && state.activeOverrides.hazard,
        },
      };

      const { error: logErr } = await supabase.from('quote_logs').insert([payload]);

      if (logErr) throw logErr;

      alert('Quote successfully logged!');
      dispatch({ type: 'RESET_FORM' });
      setQuoteData(null);
    } catch (err) {
      console.error(err);
      alert('Failed to log quote: ' + err.message);
    }
  };

  const handleSaveClientQuoteForLater = () => {
    if (!quoteData || !profile) return;

    const { currentMinQuote, currentMaxQuote } = calculateFinalQuotes(
      quoteData,
      state.activeOverrides,
      0,
      companyRates
    );

    const draft = {
      id: `draft-${Date.now()}`,
      createdAt: new Date().toISOString(),
      company_id: profile.company_id,
      customerName: state.customerName,
      customerPhone: state.customerPhone,
      quoteData,
      estimate: {
        min: currentMinQuote,
        max: currentMaxQuote,
      },
    };

    const storedDrafts = JSON.parse(localStorage.getItem('client_quote_drafts') || '[]');
    storedDrafts.unshift(draft);
    localStorage.setItem('client_quote_drafts', JSON.stringify(storedDrafts));

    alert('Quote saved for later.');
    dispatch({ type: 'RESET_FORM' });
    setQuoteData(null);
  };

  const handleAcceptClientQuote = async ({ attachmentFile = null } = {}) => {
    if (!session || !profile || !quoteData) return;

    const { currentMinQuote, currentMaxQuote, customCalculatedQuote } = calculateFinalQuotes(
      quoteData,
      state.activeOverrides,
      0,
      companyRates
    );

    const waypointsArr = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
    const pickupAddress = waypointsArr[0] || '';
    const dropoffAddress = waypointsArr[waypointsArr.length - 1] || '';

    setLoading(true);
    setError(null);

    try {
      const payload = {
        company_id: profile.company_id,
        user_id: session.user.id,
        customer_name: state.customerName,
        customer_phone: state.customerPhone,
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        all_waypoints: waypointsArr,
        base_yard_id: state.selectedBaseId,
        truck_class: state.selectedTruckClassId,
        total_miles: quoteData.totalMiles,
        total_hours: quoteData.rawTotalHours,
        min_quote: currentMinQuote,
        max_quote: currentMaxQuote,
        custom_quote: customCalculatedQuote,
        applied_surcharges: {
          afterHours: quoteData.hasAfterHours && state.activeOverrides.afterHours,
          roadClub: quoteData.hasRoadClub && state.activeOverrides.roadClub,
          metro: quoteData.hasMetroZone && state.activeOverrides.metro,
          hazard: quoteData.hasHazardZone && state.activeOverrides.hazard,
        },
        notes: `Client portal approval request${attachmentFile ? `; attachment: ${attachmentFile.name}` : ''}`,
      };

      const { error: logErr } = await supabase.from('quote_logs').insert([payload]);
      if (logErr) throw logErr;

      const notificationEmail = companyRates?.client_portal?.contact_email || profile?.email || '';
      if (notificationEmail) {
        await fetch('/api/notifyApproval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: notificationEmail,
            companyName: profile?.company_name || 'your company',
            equipmentName: quoteData?.equipmentMeta?.name || 'Custom Load',
            make: quoteData?.equipmentMeta?.make || '',
            model: quoteData?.equipmentMeta?.model || '',
            serialNumber: quoteData?.equipmentMeta?.serialNumber || '',
            weight: quoteData?.equipmentMeta?.weight || 0,
            pickupAddr: pickupAddress,
            dropoffAddr: dropoffAddress,
            contactPhone: state.customerPhone || companyRates?.client_portal?.contact_phone || '(555) 555-0199',
            contactEmail: profile?.email || companyRates?.client_portal?.contact_email || 'quotes@yourcompany.com',
            quoteAmount: currentMinQuote,
            quoteRange: `${currentMinQuote} - ${currentMaxQuote}`,
            attachmentName: attachmentFile?.name || null,
            attachmentType: attachmentFile?.type || null,
            attachmentData: attachmentFile?.data || null,
            permitFlags: quoteData?.equipmentMeta?.permitFlags || [],
            attachmentTypeLabel: quoteData?.equipmentMeta?.attachmentType || '',
            attachmentWeight: quoteData?.equipmentMeta?.attachmentWeight || 0,
          }),
        });
      }

      alert('Quote accepted. The approval request has been sent.');
      dispatch({ type: 'RESET_FORM' });
      setQuoteData(null);
    } catch (err) {
      console.error(err);
      alert('Failed to submit quote: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isInviteRoute) {
    return <InviteRegister />;
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 font-sans pb-12">
      <Header
        session={session}
        profile={profile}
        activeTab={state.activeTab}
        setActiveTab={(tab) => dispatch({ type: 'SET_TAB', payload: tab })}
        onSignOut={handleSignOut}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {!session ? (
          <div className="py-12">
            <LoginCard />
          </div>
        ) : (
          <>
            {state.activeTab === 'logs' && <QuoteLog profile={profile} />}

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
                    <ClientQuoteForm
                      companyRates={companyRates}
                      onCalculate={handleClientCalculateQuote}
                      isCalculating={loading}
                    />
                  </div>

                  <div className="lg:col-span-5">
                    {quoteData ? (
                      <QuoteResultsCard
                        state={{
                          ...state,
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
                    <div className="lg:col-span-7 bg-[#121824] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                    <div className="border-b border-slate-800/80 pb-4">
                      <h2 className="text-lg font-bold text-white tracking-tight">
                        Quote Generator
                      </h2>
                    </div>

                    {error && (
                      <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-xs font-medium">
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleCalculate} className="space-y-5">
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
                            Standard Tow / Flatbed (${companyRates?.pricing?.hourly_min || 125} - ${companyRates?.pricing?.hourly_max || 135}/hr)
                          </option>
                          {customClasses.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name} (${cls.minRate} - ${cls.maxRate}/hr)
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
                        <SurchargeToggles state={state} dispatch={dispatch} />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-bold text-xs text-white rounded-xl transition cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? 'Calculating Route...' : 'Calculate Quote'}
                      </button>
                    </form>
                    </div>

                    <div className="lg:col-span-5 mt-6 lg:mt-0">
                      {quoteData ? (
                        <QuoteResultsCard
                          state={{
                            ...state,
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
    </div>
  );
}