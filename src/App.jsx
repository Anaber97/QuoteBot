import { useWorkspaceSession } from './features/auth/useWorkspaceSession';
import { pendingOperation } from './lib/pendingOperation';
import { appReducer, initialState } from './features/quotes/calculatorState';
// src/App.jsx

// @ts-check
import React, { lazy, Suspense, useReducer, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { authenticatedFetch } from './lib/api';
import { calculateQuoteData } from './services/quoteCalculator';
import { normalizeConfig } from './lib/configSchema';

import Header from './components/Header';
import LoginCard from './components/LoginCard';
import QuoteResultsCard from './components/QuoteResultsCard';
import ClientQuoteForm from './components/ClientQuoteForm';
import DispatchCalculator from './features/quotes/DispatchCalculator';
import YardSuggestion from './features/quotes/YardSuggestion';
import { useYardComparison } from './features/quotes/useYardComparison';
import { rankYards } from './features/quotes/yardComparison';
import { quoteTotals } from './features/quotes/quoteTotal';
import QuoteReport from './components/QuoteReport';
const Settings = lazy(() => import('./components/Settings'));
import Toast from './components/Toast';
import Footer from './components/Footer';
import LegalPage from './components/LegalPage';

const QuoteLog = lazy(() => import('./components/QuoteLog'));
const InviteRegister = lazy(() => import('./components/InviteRegister'));
const LoadingPanel = () => <div className="p-8 text-center text-sm text-slate-400" role="status">Loading…</div>;

const normalizeCompanyConfig = (rawConfig = {}) => normalizeConfig(rawConfig);

export default function App() {
  const legalRoute = window.location.pathname.replace(/\/+$/, '') || '/';
  const [notice, setNotice] = useState(null);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [theme, setTheme] = useState(() => localStorage.getItem('towcalc_theme') || 'dark');
  const [isInviteRoute, setIsInviteRoute] = useState(false);

  const [loading, setLoading] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [showEquipmentCalculator, setShowEquipmentCalculator] = useState(false);
  const [openedLoggedQuote, setOpenedLoggedQuote] = useState(null);
  const [error, setError] = useState(null);
  const [switchingYard, setSwitchingYard] = useState(false);
  const lastEquipmentPayload = useRef(null);

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

  const { session, profile, companyRates, setCompanyRates, profileLoadError } = useWorkspaceSession(resetCalculatorState);

  const handleOpenLoggedQuote = (loggedQuote) => {
    dispatch({ type: 'LOAD_LOGGED_QUOTE', payload: loggedQuote });
    setQuoteData(null);
    setOpenedLoggedQuote(loggedQuote);
    setShowEquipmentCalculator(['client_portal', 'equipment_calculator'].includes(loggedQuote.quote_source));
  };

  useEffect(() => {
    const quoteId = new URLSearchParams(window.location.search).get('quote');
    if (!quoteId || !session?.user?.id || !profile?.company_id) return;
    let active = true;
    const openLinkedQuote = async () => {
      const { data, error: loadError } = await supabase.from('quote_logs').select('*').eq('id', quoteId).eq('company_id', profile.company_id).single();
      if (!active) return;
      if (loadError || !data) setNotice({ tone: 'error', message: 'This quote is unavailable or you do not have access to it.' });
      else handleOpenLoggedQuote(data);
    };
    void openLinkedQuote();
    return () => { active = false; };
  }, [session?.user?.id, profile?.company_id, profile?.client_id]);

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
  const handleCalculate = async (e, { baseId } = {}) => {
    if (e) e.preventDefault();
    const base = baseId ? availableBases.find((item) => String(item.id) === String(baseId)) : currentBase;
    setLoading(true);
    setError(null);

    try {
      const waypointsArr = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
      const cleanWaypoints = waypointsArr.map((w) => w.trim()).filter(Boolean);

      if (cleanWaypoints.length < 1) {
        throw new Error('Please enter a Pick-up location.');
      }
      if (!base?.address) {
        throw new Error('Add a Base Yard in Settings before calculating a quote.');
      }

      const data = await calculateQuoteData({
        currentBase: base,
        waypoints: cleanWaypoints.length === 1 ? [cleanWaypoints[0], cleanWaypoints[0]] : cleanWaypoints,
        selectedTruckClassId: state.selectedTruckClassId,
        isHeavy: state.selectedTruckClassId === 'heavy' || state.selectedTruckClassId === '3',
        isAfterHours: state.isAfterHours,
        isRoadClub: state.isRoadClub,
        isMetro: state.isMetro,
        isHazard: state.isHazard,
        companyRates,
      });

      dispatch({ type: 'RESET_QUOTE_OVERRIDES' });
      setQuoteData({ ...data, baseId: base.id, appliedCustomSurcharges: state.pendingCustomSurcharges });
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
  const handleClientCalculateQuote = async (clientPayload, { baseId } = {}) => {
    const base = baseId ? availableBases.find((item) => String(item.id) === String(baseId)) : currentBase;
    if (!isClientPortalUser) lastEquipmentPayload.current = clientPayload;
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
      lengthFt,
      overhangFt,
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
      let data;
      if (isClientPortalUser) {
        const response = await authenticatedFetch('/api/createQuote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preview: true, baseId: state.selectedBaseId,
            waypoints: routeWaypoints, equipment: { name: equipmentName, make, model, serialNumber,
              weight, width, height, attachmentType, attachmentWeight, lengthFt, overhangFt } }),
        });
        const result = await response.json();
        if (!response.ok || !result.estimate) throw new Error(result.error || 'Unable to calculate your quote.');
        data = { authoritativeTotal: result.estimate.total, totalMiles: result.estimate.totalMiles,
          totalHours: result.estimate.totalHours, rawTotalHours: result.estimate.totalHours,
          approvalRequired: result.estimate.approvalRequired, cleanWaypoints: routeWaypoints };
      } else {
        data = await calculateQuoteData({
        currentBase: base,
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
        equipmentLengthFt: lengthFt,
        equipmentOverhangFt: overhangFt,
        clientConfig: activeClientConfig,
        useWeightTierPricing: true,
      });
      }

      const permitFee = Number(data.osow?.permitFee ?? permitInfo?.permitFee ?? 0);

      dispatch({ type: 'RESET_QUOTE_OVERRIDES' });
      setQuoteData({
        ...data,
        baseId: base?.id,
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
          permitFlags: data.osow?.flags ?? permitInfo?.flags ?? [],
          osow: data.osow,
          attachmentType,
          attachmentWeight: Number(attachmentWeight || 0),
          lengthFt,
          overhangFt,
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
  const handleLogQuote = async ({ attachmentFile = null, forReport = false } = {}) => {
    if (!session || !profile || !quoteData) return;

    try {
      const waypointsArr = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
      const payload = {
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
          customDriveTimeBufferPercent: state.customDriveTimeBufferPercent,
          customerName: state.customerName,
          customerPhone: state.customerPhone,
          notes: state.quoteNotes,
          equipment: {
            ...(quoteData.equipmentMeta || {}),
            make: state.quoteMake || quoteData.equipmentMeta?.make || '',
            model: state.quoteModel || quoteData.equipmentMeta?.model || '',
          },
        };
      const operation = await pendingOperation('quote:' + profile.id, payload);
      const response = await authenticatedFetch('/api/createQuote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operation.id },
        body: JSON.stringify(payload),
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

      if (forReport) return { quote: loggedQuote, complete: operation.complete };
      operation.complete();
      setNotice({ message: attachmentFile ? 'Quote logged with BOL attached!' : 'Quote successfully logged!' });
      dispatch({ type: 'RESET_FORM' });
      setQuoteData(null);
    } catch (err) {
      if (forReport) throw err;
      console.error(err);
      setNotice({ tone: 'error', message: `Failed to log quote: ${err.message}` });
    }
  };

  const handleReportQuote = async (reason) => {
    const saved = quoteData.reportQuoteId ? { quote: { id: quoteData.reportQuoteId }, complete: () => {} } : await handleLogQuote({ forReport: true });
    if (!saved?.quote?.id) throw new Error('Please sign in and calculate a quote first.');
    setQuoteData((current) => current === quoteData ? { ...current, reportQuoteId: saved.quote.id } : current);
    const payload = { quoteId: saved.quote.id, action: 'report', reason, displayedTotal: quoteData.authoritativeTotal };
    const operation = await pendingOperation('report:' + profile.id, payload);
    const response = await authenticatedFetch('/api/sendQuoteEmail', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operation.id }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Report could not be sent. Please retry.');
    operation.complete(); saved.complete();
  };

  // Best yard: re-price the current quote from every other yard and offer the cheapest.
  const yardLegs = useYardComparison({
    waypoints: quoteData?.cleanWaypoints,
    yardCount: availableBases.length,
    enabled: Boolean(quoteData && !isClientPortalUser && quoteData.baseId != null && Array.isArray(quoteData.legsDetails)),
  });
  const bestYard = rankYards({
    yards: yardLegs,
    currentYardId: quoteData?.baseId,
    quoteData,
    priceFor: (candidate) => quoteTotals(candidate, state, companyRates, true).total,
  })[0] || null;

  const handleSwitchYard = async (baseId) => {
    dispatch({ type: 'SET_BASE', payload: baseId });
    setSwitchingYard(true);
    try {
      if (showEquipmentCalculator && lastEquipmentPayload.current) await handleClientCalculateQuote(lastEquipmentPayload.current, { baseId });
      else await handleCalculate(null, { baseId });
    } finally {
      setSwitchingYard(false);
    }
  };

  if (legalRoute === '/privacy') return <LegalPage type="privacy" />;
  if (legalRoute === '/terms') return <LegalPage type="terms" />;

  if (isInviteRoute) {
    return <div className="flex min-h-screen flex-col bg-canvas"><Suspense fallback={<LoadingPanel />}><InviteRegister /></Suspense><Footer /></div>;
  }

  return (
    <div className="app-shell flex min-h-screen flex-col bg-canvas text-slate-100 font-sans overflow-x-hidden">
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
              <Suspense fallback={<LoadingPanel />}><Settings
                profile={profile}
                currentUserRole={profile?.role || 'manager'}
                config={companyRates}
                onSaveConfig={handleSettingsSave}
              /></Suspense>
            )}

            {state.activeTab === 'calculator' && (
              isClientPortalUser ? (
                /* CLIENT PORTAL VIEW */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-7">
                    {error && <div role="alert" className="mb-4 rounded-xl border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}
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
                      <><QuoteResultsCard
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
                      /><QuoteReport onSubmit={handleReportQuote} /></>
                    ) : (
                      <div className="hidden lg:block p-6 bg-panel border border-slate-800 rounded-2xl text-slate-400 space-y-2">
                        <h4 className="text-sm font-bold text-slate-200">Quote estimate</h4>
                        <p className="text-sm max-w-sm">
                          Search your equipment and enter pickup/dropoff locations to view an instant transport quote.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* DISPATCHER / MANAGER CALCULATOR VIEW */
                <DispatchCalculator
                  state={state}
                  dispatch={dispatch}
                  companyRates={companyRates}
                  bases={availableBases}
                  currentBase={currentBase}
                  truckClasses={customClasses}
                  quoteData={quoteData}
                  loading={loading}
                  error={error}
                  showEquipmentCalculator={showEquipmentCalculator}
                  onShowEquipmentCalculator={(equipment) => {
                    if (equipment === showEquipmentCalculator) return;
                    setShowEquipmentCalculator(equipment); setQuoteData(null); setError(null);
                  }}
                  onCalculate={handleCalculate}
                  onEquipmentCalculate={handleClientCalculateQuote}
                  onReset={resetCalculatorState}
                  openedLoggedQuote={openedLoggedQuote}
                  onLogQuote={handleLogQuote}
                  resultsRef={resultsRef}
                  yardSuggestion={<YardSuggestion suggestion={bestYard} onSwitch={handleSwitchYard} busy={switchingYard} />}
                />
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
