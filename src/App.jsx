// src/App.jsx

// @ts-check
import React, { useReducer, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { authenticatedFetch } from './lib/api';
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
  return savedBase || '';
};

const normalizeDriveTimeBuffer = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 10;
  if (num > 1.5) return num;
  if (num > 0) return (num - 1) * 100;
  return 10;
};

const normalizeCompanyConfig = (rawConfig = {}) => {
  // app_config has a legacy JSON "config" column plus the newer structured
  // columns. Merge the legacy object first so either storage format works.
  const config = {
    ...(rawConfig.config && typeof rawConfig.config === 'object' ? rawConfig.config : {}),
    ...rawConfig,
  };
  const customSurcharges = config.pricing?.custom_surcharges ?? config.surcharges?.custom_surcharges;
  const normalizedCustomSurcharges = Array.isArray(customSurcharges)
    ? customSurcharges.map((item, index) => ({
        id: item.id || `surcharge-${index + 1}`,
        name: item.name || `Custom Surcharge ${index + 1}`,
        feeType: item.feeType || 'flat',
        value: Number(item.value ?? 0) || 0,
        active: item.active !== false,
      }))
    : null;

  return {
  ...DEFAULT_CONFIG,
  ...config,
  company_id: config.company_id || DEFAULT_CONFIG.company_id,
  pricing: {
    ...(DEFAULT_CONFIG.pricing || {}),
    ...(config.pricing || {}),
    ...(config.surcharges || {}),
    surchargeModes: {
      ...(DEFAULT_CONFIG.pricing?.surchargeModes || {}),
      ...(config.pricing?.surchargeModes || config.surcharges?.surchargeModes || {}),
    },
    rounding_interval: Number(
      config.pricing?.rounding_interval ?? config.rounding_interval ?? DEFAULT_CONFIG.pricing.rounding_interval
    ) || 25,
    hourly_min: Number(config.pricing?.hourly_min ?? config.hourly_min ?? DEFAULT_CONFIG.pricing.hourly_min) || 125,
    hourly_max: Number(config.pricing?.hourly_max ?? config.hourly_max ?? DEFAULT_CONFIG.pricing.hourly_max) || 135,
    drive_time_buffer: normalizeDriveTimeBuffer(config.pricing?.drive_time_buffer ?? config.drive_time_buffer ?? DEFAULT_CONFIG.pricing.drive_time_buffer),
    after_hours_multiplier: Number(config.pricing?.after_hours_multiplier ?? config.surcharges?.after_hours_multiplier ?? config.after_hours_multiplier ?? DEFAULT_CONFIG.pricing.after_hours_multiplier) || 25,
    road_club_multiplier: Number(config.pricing?.road_club_multiplier ?? config.surcharges?.road_club_multiplier ?? config.road_club_multiplier ?? DEFAULT_CONFIG.pricing.road_club_multiplier) || 15,
    metro_multiplier: Number(config.pricing?.metro_multiplier ?? config.surcharges?.metro_multiplier ?? DEFAULT_CONFIG.pricing.metro_multiplier) || 28.57,
    hazard_multiplier: Number(config.pricing?.hazard_multiplier ?? config.surcharges?.hazard_multiplier ?? DEFAULT_CONFIG.pricing.hazard_multiplier) || 40,
    load_unload_base_mins: Number(config.pricing?.load_unload_base_mins ?? config.load_unload_base_mins ?? DEFAULT_CONFIG.pricing.load_unload_base_mins) || 30,
    extra_stop_mins: Number(config.pricing?.extra_stop_mins ?? config.extra_stop_mins ?? DEFAULT_CONFIG.pricing.extra_stop_mins) || 15,
    custom_truck_classes: Array.isArray(config.pricing?.custom_truck_classes) ? config.pricing.custom_truck_classes : DEFAULT_CONFIG.pricing.custom_truck_classes,
    custom_surcharges: normalizedCustomSurcharges || DEFAULT_CONFIG.pricing.custom_surcharges,
  },
  surcharges: {
    ...(DEFAULT_CONFIG.surcharges || {}),
    ...(config.surcharges || {}),
    custom_surcharges: normalizedCustomSurcharges || DEFAULT_CONFIG.surcharges.custom_surcharges,
  },
  geofences: {
    disabledZones: config.geofences?.disabledZones || [],
    customZoneRates: config.geofences?.customZoneRates || {},
    customZones: Array.isArray(config.geofences?.customZones)
      ? config.geofences.customZones.map((zone) => ({
          id: zone.id || `custom-${Math.random().toString(36).slice(2)}`,
          name: zone.name || 'Custom Geofence',
          localityQuery: zone.localityQuery || '',
          city: zone.city || '',
          state: zone.state || '',
          feeType: zone.feeType || 'percent',
          price: Number(zone.price ?? 0) || 0,
          shape: Array.isArray(zone.shape) ? zone.shape : [],
          type: 'custom',
        }))
      : [],
  },
  bases: Array.isArray(config.bases) ? config.bases : DEFAULT_CONFIG.bases,
  users: Array.isArray(config.users) ? config.users.filter(Boolean) : [],
  client_portal: {
    ...(DEFAULT_CONFIG.client_portal || {}),
    ...(config.client_portal || {}),
    approval_threshold: Number(config.client_portal?.approval_threshold ?? DEFAULT_CONFIG.client_portal.approval_threshold) || 80000,
    rounding_interval: Number(config.client_portal?.rounding_interval ?? DEFAULT_CONFIG.client_portal.rounding_interval) || 25,
    weight_tiers: Array.isArray(config.client_portal?.weight_tiers) && config.client_portal.weight_tiers.length > 0
      ? config.client_portal.weight_tiers.map((tier, index) => ({
          id: tier.id || `tier-${index + 1}`,
          label: tier.label || `Tier ${index + 1}`,
          minWeight: Number(tier.minWeight ?? tier.min ?? 0) || 0,
          maxWeight: Number(tier.maxWeight ?? tier.max ?? 999999) || 999999,
          rate: Number(tier.rate ?? tier.hourly_rate ?? 0) || 0,
          rounding_interval: Number(tier.rounding_interval ?? 25) || 25,
          drive_time_buffer: Number(tier.drive_time_buffer ?? 10) || 10,
          load_unload_base_mins: Number(tier.load_unload_base_mins ?? 30) || 30,
        }))
      : DEFAULT_CONFIG.client_portal.weight_tiers,
    clients: Array.isArray(config.client_portal?.clients)
      ? config.client_portal.clients.map((client) => ({
          ...client,
          pricing: client.pricing || {},
        }))
      : [],
  },
  };
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
  activeOverrides: { afterHours: true, roadClub: true, metro: true, hazard: true, customSurcharges: {} },
  pendingCustomSurcharges: {},
  showDetails: false,
  customerName: '',
  customerPhone: '',
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
    case 'SET_CUSTOM_RATE':
      return { ...state, customRateInput: action.payload };
    case 'SET_CUSTOM_LOAD_UNLOAD':
      return { ...state, customLoadUnloadMins: action.payload };
    case 'SET_PENDING_CUSTOM_SURCHARGES':
      return { ...state, pendingCustomSurcharges: action.payload };
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
  const [theme, setTheme] = useState(() => localStorage.getItem('towcalc_theme') || 'dark');
  const [isInviteRoute, setIsInviteRoute] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [companyRates, setCompanyRates] = useState(() => normalizeCompanyConfig(DEFAULT_CONFIG));

  const [loading, setLoading] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [showEquipmentCalculator, setShowEquipmentCalculator] = useState(false);
  const [error, setError] = useState(null);
  const currentAuthUserIdRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('towcalc_theme', theme);
  }, [theme]);

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
            .select('id, company_id, client_name, contact_email, contact_phone, approval_threshold, pricing')
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
    }
  };

  const handleSettingsSave = (newConfig) => {
    setCompanyRates(normalizeCompanyConfig(newConfig));
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
        clientConfig: activeClientConfig,
        useWeightTierPricing: true,
      });

      const permitFee = Number(permitInfo?.permitFee || 0);

      if (data.approvalRequired) {
        try {
          await authenticatedFetch('/api/notifyApproval', {
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

  const _handleAcceptClientQuote = async ({ attachmentFile = null } = {}) => {
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
        await authenticatedFetch('/api/notifyApproval', {
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
    <div className="app-shell min-h-screen bg-[#080c14] text-slate-100 font-sans pb-12 overflow-x-hidden">
      <Header
        session={session}
        profile={profile}
        activeTab={state.activeTab}
        setActiveTab={(tab) => dispatch({ type: 'SET_TAB', payload: tab })}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
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
                          activeOverrides: { ...state.activeOverrides, customSurcharges: quoteData.appliedCustomSurcharges || {} },
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
                      <ClientQuoteForm companyRates={companyRates} onCalculate={handleClientCalculateQuote} isCalculating={loading} title="Equipment Calculator" onReset={resetCalculatorState} />
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
                            activeOverrides: { ...state.activeOverrides, customSurcharges: quoteData.appliedCustomSurcharges || {} },
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
