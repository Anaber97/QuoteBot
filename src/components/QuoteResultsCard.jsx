import { resolveZoneCharge, formatZoneCharge } from '../../shared/pricing/zoneCharge.js';
import QuoteTripBreakdown from '../features/quotes/QuoteTripBreakdown';
// src/components/QuoteResultsCard.jsx
import React from 'react';
import QuoteSaveForm from '../features/quotes/QuoteSaveForm';
import { calculateFinalQuotes } from '../services/quoteCalculator';
import { summarizeHighestOsowFlag } from '../lib/osow.js';
import { estimateDisclaimer } from '../legal/legalContent';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const BADGE_STYLES = {
  afterHours: {
    active: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    disabled: 'bg-slate-900/60 border-slate-800 text-slate-500',
    label: 'After Hours (+25%)',
  },
  roadClub: {
    active: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300',
    disabled: 'bg-slate-900/60 border-slate-800 text-slate-500',
    label: 'Road Club (+15%)',
  },
  metro: {
    active: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
    disabled: 'bg-slate-900/60 border-slate-800 text-slate-500',
    label: 'Metro Zone',
  },
  hazard: {
    active: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
    disabled: 'bg-slate-900/60 border-slate-800 text-slate-500',
    label: 'Hazard Zone (+40%)',
  },
  custom: {
    active: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    disabled: 'border-slate-700 bg-slate-900/60 text-slate-500',
    label: 'Custom Zone',
  },
};

// Distinct surcharge badge styling
export default function QuoteResultsCard({
  state,
  dispatch,
  resultsRef,
  onLogQuote,
  onSaveForLater,
  onAcceptQuote,
  companyRates = {},
  isDispatcherView = false,
}) {
  const {
    quoteData,
    activeOverrides,
  } = state || {};
  const showDetails = Boolean(state?.showDetails);

  if (!quoteData) return null;

  const { currentMinQuote, customCalculatedQuote, timeMetrics, effectiveRate, effectiveBaseQuote } = calculateFinalQuotes(
    quoteData,
    activeOverrides,
    state?.customRateInput ?? state?.customRate ?? 0,
    companyRates,
    state?.customLoadUnloadMins ?? null,
    isDispatcherView,
    state?.customDriveTimeBufferPercent ?? null
  );
  const permitFee = Number(quoteData?.equipmentMeta?.permitFee || quoteData?.permitFee || 0);
  const osow = quoteData?.osow || quoteData?.equipmentMeta?.osow;
  // Client estimates do not present OSOW screening. Dispatchers see it only
  // when the regular equipment calculator identifies an actual permit need.
  const shouldShowOsowEstimate = isDispatcherView && osow?.needsPermit === true;
  const escort = quoteData?.escort || quoteData?.equipmentMeta?.escort || { vehicleCount: 0, surcharge: 0 };
  const permitSurcharge = osow
    ? Number(osow.permitFee || 0) + Number(escort.surcharge || 0)
    : permitFee;
  const osowFlagSummary = shouldShowOsowEstimate ? summarizeHighestOsowFlag(osow?.states) : null;
  const attachmentWeight = Number(quoteData?.equipmentMeta?.attachmentWeight || 0);
  const effectiveMinQuote = !isDispatcherView && Number.isFinite(quoteData.authoritativeTotal)
    ? quoteData.authoritativeTotal
    : (isDispatcherView ? customCalculatedQuote ?? currentMinQuote : currentMinQuote) + (osow ? 0 : permitFee);
  const clientPrice = effectiveMinQuote;
  const isFixedEquipmentQuote = quoteData?.pricingMode === 'equipment-weight-tier';
  const isMileageQuote = (quoteData?.pricingRateMode || quoteData?.pricingMode) === 'mileage';
  const dispatcherSurcharges = [
    quoteData?.hasAfterHours ? { key: 'afterHours', active: activeOverrides?.afterHours } : null,
    quoteData?.hasRoadClub ? { key: 'roadClub', active: activeOverrides?.roadClub } : null,
    quoteData?.hasMetroZone ? { key: 'metro', active: activeOverrides?.metro } : null,
    quoteData?.hasHazardZone ? { key: 'hazard', active: activeOverrides?.hazard } : null,
    quoteData?.hasCustomZone ? { key: 'custom', active: true } : null,
  ].filter(Boolean);
  const quoteCustomSurcharges = quoteData?.appliedCustomSurcharges || {};
  const availableCustomSurcharges = (companyRates.pricing?.custom_surcharges || []).filter((item) =>
    item.active !== false && quoteCustomSurcharges[item.id] === true
  );
  const hasAppliedSurcharges = dispatcherSurcharges.some((item) => item.active === true)
    || availableCustomSurcharges.some((item) => activeOverrides?.customSurcharges?.[item.id] === true);
  const metroCodes = Array.isArray(quoteData?.metroCodes) && quoteData.metroCodes.length > 0 ? quoteData.metroCodes : [];
  const metroCharge = quoteData.metroMatches?.[0]?.charge ?? resolveZoneCharge({ multiplier: 1.2857 }, companyRates, 'metro_multiplier');
  const metroBadgeLabel = 'Metro Zone (' + formatZoneCharge(metroCharge) + ')';
  const routeLegs = Array.isArray(quoteData?.legsDetails) ? quoteData.legsDetails : [];

  // Dispatcher map should show the full base-to-base route; client map should show pickup-to-dropoff.
  const routeAddresses = isDispatcherView
    ? (Array.isArray(quoteData?.routeAddresses) && quoteData.routeAddresses.length > 0
      ? quoteData.routeAddresses.filter(Boolean)
      : [])
    : (Array.isArray(quoteData?.cleanWaypoints) && quoteData.cleanWaypoints.length > 0
      ? quoteData.cleanWaypoints.filter(Boolean)
      : []);

  const origin = encodeURIComponent(routeAddresses[0] || '');
  const destination = encodeURIComponent(routeAddresses[routeAddresses.length - 1] || '');
  const intermediateWaypoints = routeAddresses
    .slice(1, -1)
    .map((wp) => encodeURIComponent(wp))
    .join('|');

  const mapEmbedUrl =
    routeAddresses.length >= 2 && GOOGLE_MAPS_API_KEY
      ? `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${origin}&destination=${destination}${
          intermediateWaypoints ? `&waypoints=${intermediateWaypoints}` : ''
        }&mode=driving`
      : null;

  const toggleOverride = (key) => {
    dispatch?.({ type: 'SET_OVERRIDE', payload: { key, value: !activeOverrides?.[key] } });
  };

  const toggleCustomSurcharge = (id) => {
    dispatch?.({
      type: 'SET_OVERRIDE',
      payload: {
        key: 'customSurcharges',
        value: {
          ...(activeOverrides?.customSurcharges || {}),
          [id]: activeOverrides?.customSurcharges?.[id] !== true,
        },
      },
    });
  };

  return (
    <div
      ref={resultsRef}
      className="mt-6 lg:mt-0 bg-[#0c1019] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-5 transition-all min-w-0"
    >
      {/* 1. Single Price Display */}
      <div className="text-center space-y-1">
        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
          {isDispatcherView ? 'Estimated Total Quote' : 'Your Estimated Quote'}
        </span>
        <div className="text-4xl font-black text-white tracking-tight">${clientPrice}</div>
        {isDispatcherView && isFixedEquipmentQuote && (
          <div className="text-[11px] text-slate-400">
            {quoteData.weightTierLabel || 'Equipment weight class'} · ${Number(effectiveRate).toFixed(quoteData.pricingRateMode === 'mileage' ? 2 : 0)}/{quoteData.pricingRateMode === 'mileage' ? 'mi' : 'hr'}
          </div>
        )}
        {isDispatcherView && permitSurcharge > 0 && (
          <div aria-label="Permit surcharge" title="Permit surcharge included" className="inline-block bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs px-2.5 py-0.5 rounded-full mt-1">
            +${permitSurcharge.toFixed(2)}
          </div>
        )}
        {!osow && Number(escort.vehicleCount) > 0 && <div className="inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-300">
          {escort.vehicleCount} escort vehicle{Number(escort.vehicleCount) === 1 ? '' : 's'}: +${Number(escort.surcharge || 0).toFixed(2)}
        </div>}
        {attachmentWeight > 0 && (
          <div className="inline-block bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold text-xs px-2.5 py-0.5 rounded-full mt-1">
            Attachment weight included: {attachmentWeight.toLocaleString()} lbs
          </div>
        )}
      </div>

      {!isDispatcherView && (
        <p role="note" className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[11px] leading-5 text-slate-300">
          <span className="font-semibold text-blue-300">Estimate notice: </span>
          {companyRates?.client_portal?.disclosure || estimateDisclaimer}
        </p>
      )}

      {isDispatcherView && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {dispatcherSurcharges.map(({ key, active }) => {
              const style = BADGE_STYLES[key];
              if (!style) return null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleOverride(key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${active ? style.active : style.disabled}`}
                  title={active ? 'Click to remove surcharge' : 'Click to restore surcharge'}
                  aria-pressed={active}
                >
                  <span>{key === 'metro' ? metroBadgeLabel : style.label}</span>
                  <span className="rounded bg-black/20 px-1 text-[10px] font-black leading-none opacity-80">
                    {active ? '✕' : '↻'}
                  </span>
                </button>
              );
            })}
            {availableCustomSurcharges.map((item) => {
              const active = activeOverrides?.customSurcharges?.[item.id] === true;
              return (
              <button key={item.id} type="button" onClick={() => toggleCustomSurcharge(item.id)} title={active ? 'Click to remove surcharge' : 'Click to restore surcharge'} aria-pressed={active} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${active ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : BADGE_STYLES.custom.disabled}`}>
                <span>{item.name} ({item.feeType === 'percent' ? `+${item.value}%` : `+$${item.value}`})</span>
                <span className="rounded bg-black/20 px-1 text-[10px] font-black leading-none opacity-80">{active ? '✕' : '↻'}</span>
              </button>
              );
            })}
            {!hasAppliedSurcharges && (
              <span className="text-[10px] uppercase tracking-wide text-slate-500">No surcharge add-ons applied</span>
            )}
          </div>
          <div className="text-center">
            <button
              type="button"
              aria-expanded={showDetails}
              onClick={() => dispatch?.({ type: 'TOGGLE_DETAILS' })}
              className="mt-3 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4 cursor-pointer transition"
            >
              {showDetails ? '▲ Hide Trip Breakdown' : '▼ Show Trip Breakdown'}
            </button>
          </div>

          {showDetails && <QuoteTripBreakdown
            state={state}
            dispatch={dispatch}
            quoteData={quoteData}
            activeOverrides={activeOverrides}
            isMileageQuote={isMileageQuote}
            effectiveRate={effectiveRate}
            timeMetrics={timeMetrics}
            routeLegs={routeLegs}
            metroCodes={metroCodes}
            isFixedEquipmentQuote={isFixedEquipmentQuote}
            effectiveBaseQuote={effectiveBaseQuote}
            permitSurcharge={permitSurcharge}
            osow={osow}
            osowFlagSummary={osowFlagSummary}
            escort={escort}
          />}
        </div>
      )}

      {/* 2. Google Maps Minimap Preview */}
      {mapEmbedUrl && (
        <div className="rounded-xl overflow-hidden border border-slate-800 shadow-xl bg-[#080c14] h-52 w-full">
          <iframe
            title="Route Map Preview"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={mapEmbedUrl}
          />
        </div>
      )}

      <QuoteSaveForm state={state} dispatch={dispatch} isDispatcherView={isDispatcherView}
        onLogQuote={onLogQuote} onSaveForLater={onSaveForLater} onAcceptQuote={onAcceptQuote} />

    </div>
  );
}
