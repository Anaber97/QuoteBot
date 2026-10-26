import { resolveZoneCharge, formatZoneCharge } from '../../shared/pricing/zoneCharge.js';
import QuoteTripBreakdown from '../features/quotes/QuoteTripBreakdown';
// src/components/QuoteResultsCard.jsx
import React from 'react';
import { ChevronDown } from 'lucide-react';
import QuoteSaveForm from '../features/quotes/QuoteSaveForm';
import { quoteTotals } from '../features/quotes/quoteTotal';
import { summarizeHighestOsowFlag } from '../lib/osow.js';
import { estimateDisclaimer } from '../legal/legalContent';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const CHARGE_LABELS = {
  afterHours: 'After hours (+25%)',
  roadClub: 'Road club (+15%)',
  hazard: 'Hazard zone (+40%)',
  custom: 'Custom zone',
};

const chipClass = (active) => `inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition cursor-pointer ${
  active ? 'border-accent/40 bg-accent/10 text-accent-text' : 'border-slate-800 text-slate-500 hover:text-slate-300'
}`;

const Mark = ({ active }) => (
  <span className="text-xs font-black opacity-70">{active ? '✕' : '↻'}</span>
);

export default function QuoteResultsCard({
  state,
  dispatch,
  resultsRef,
  onLogQuote,
  onSaveForLater,
  onAcceptQuote,
  companyRates = {},
  isDispatcherView = false,
  yardSuggestion = null,
}) {
  const { quoteData, activeOverrides } = state || {};
  const showDetails = Boolean(state?.showDetails);

  if (!quoteData) return null;

  const { total: clientPrice, timeMetrics, effectiveRate, effectiveBaseQuote, permitFee, osow } = quoteTotals(quoteData, state, companyRates, isDispatcherView);
  // Client estimates do not present OSOW screening. Dispatchers see it only
  // when the regular equipment calculator identifies an actual permit need.
  const shouldShowOsowEstimate = isDispatcherView && osow?.needsPermit === true;
  const escort = quoteData?.escort || quoteData?.equipmentMeta?.escort || { vehicleCount: 0, surcharge: 0 };
  const permitSurcharge = osow
    ? Number(osow.permitFee || 0) + Number(escort.surcharge || 0)
    : permitFee;
  const osowFlagSummary = shouldShowOsowEstimate ? summarizeHighestOsowFlag(osow?.states) : null;
  const attachmentWeight = Number(quoteData?.equipmentMeta?.attachmentWeight || 0);
  const isFixedEquipmentQuote = quoteData?.pricingMode === 'equipment-weight-tier';
  const isMileageQuote = (quoteData?.pricingRateMode || quoteData?.pricingMode) === 'mileage';
  const dispatcherSurcharges = [
    quoteData?.hasAfterHours ? { key: 'afterHours', active: activeOverrides?.afterHours } : null,
    quoteData?.hasRoadClub ? { key: 'roadClub', active: activeOverrides?.roadClub } : null,
    quoteData?.hasMetroZone ? { key: 'metro', active: activeOverrides?.metro } : null,
    quoteData?.hasHazardZone ? { key: 'hazard', active: activeOverrides?.hazard } : null,
    quoteData?.hasCustomZone ? { key: 'custom', active: activeOverrides?.custom !== false } : null,
  ].filter(Boolean);
  const quoteCustomSurcharges = quoteData?.appliedCustomSurcharges || {};
  const availableCustomSurcharges = (companyRates.pricing?.custom_surcharges || []).filter((item) =>
    item.active !== false && quoteCustomSurcharges[item.id] === true
  );
  const hasCharges = dispatcherSurcharges.length > 0 || availableCustomSurcharges.length > 0;
  const hasAppliedSurcharges = dispatcherSurcharges.some((item) => item.active === true)
    || availableCustomSurcharges.some((item) => activeOverrides?.customSurcharges?.[item.id] === true);
  const metroCodes = Array.isArray(quoteData?.metroCodes) && quoteData.metroCodes.length > 0 ? quoteData.metroCodes : [];
  const metroCharge = quoteData.metroMatches?.[0]?.charge ?? resolveZoneCharge({ multiplier: 1.2857 }, companyRates, 'metro_multiplier');
  const routeLegs = Array.isArray(quoteData?.legsDetails) ? quoteData.legsDetails : [];
  const rateUnit = isMileageQuote ? 'mi' : 'h';
  const summary = [
    isMileageQuote ? `${Number(quoteData.totalMiles || 0).toFixed(1)} mi` : `${Number(timeMetrics?.rawTotalHours || 0).toFixed(2)} h`,
    !isMileageQuote && quoteData.totalMiles ? `${Math.round(quoteData.totalMiles)} mi` : null,
    `$${Number(effectiveRate || 0).toFixed(isMileageQuote ? 2 : 0)}/${rateUnit}`,
    isFixedEquipmentQuote ? quoteData.weightTierLabel || 'Equipment weight class' : null,
  ].filter(Boolean).join(' · ');

  // Dispatcher map should show the full base-to-base route; client map should show pickup-to-dropoff.
  const routeAddresses = isDispatcherView
    ? (Array.isArray(quoteData?.routeAddresses) ? quoteData.routeAddresses.filter(Boolean) : [])
    : (Array.isArray(quoteData?.cleanWaypoints) ? quoteData.cleanWaypoints.filter(Boolean) : []);
  const origin = encodeURIComponent(routeAddresses[0] || '');
  const destination = encodeURIComponent(routeAddresses[routeAddresses.length - 1] || '');
  const intermediateWaypoints = routeAddresses.slice(1, -1).map((wp) => encodeURIComponent(wp)).join('|');
  const mapEmbedUrl =
    routeAddresses.length >= 2 && GOOGLE_MAPS_API_KEY
      ? `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${origin}&destination=${destination}${
          intermediateWaypoints ? `&waypoints=${intermediateWaypoints}` : ''
        }&mode=driving`
      : null;

  const toggleOverride = (key) => {
    const active = key === 'custom' ? activeOverrides?.custom !== false : activeOverrides?.[key];
    dispatch?.({ type: 'SET_OVERRIDE', payload: { key, value: !active } });
  };

  const toggleCustomSurcharge = (id) => {
    dispatch?.({
      type: 'SET_OVERRIDE',
      payload: {
        key: 'customSurcharges',
        value: { ...(activeOverrides?.customSurcharges || {}), [id]: activeOverrides?.customSurcharges?.[id] !== true },
      },
    });
  };

  return (
    <section
      ref={resultsRef}
      aria-labelledby="quote-ticket-title"
      className="min-w-0 space-y-6 rounded-2xl border border-slate-800 bg-panel p-5 sm:p-6"
    >
      <header className="space-y-2">
        <h2 id="quote-ticket-title" className="m-0 text-sm font-semibold text-slate-400">
          {isDispatcherView ? 'Quote' : 'Your estimated quote'}
        </h2>
        <div aria-live="polite" className="text-6xl font-extrabold leading-none tracking-tight text-white tabular-nums">
          {'$' + Number(clientPrice || 0).toLocaleString('en-US')}
        </div>
        {isDispatcherView && <p className="m-0 text-sm text-slate-400 tabular-nums">{summary}</p>}
        {isDispatcherView && (permitSurcharge > 0 || attachmentWeight > 0 || (!osow && Number(escort.vehicleCount) > 0)) && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm">
            {permitSurcharge > 0 && (
              <li aria-label="Permit surcharge" title="Permit surcharge included" className="rounded-md bg-amber-500/10 px-2 py-1 font-semibold text-amber-300 tabular-nums">
                Permit +${permitSurcharge.toFixed(2)}
              </li>
            )}
            {!osow && Number(escort.vehicleCount) > 0 && (
              <li className="rounded-md bg-slate-800 px-2 py-1 font-semibold text-slate-200 tabular-nums">
                {escort.vehicleCount} escort vehicle{Number(escort.vehicleCount) === 1 ? '' : 's'}: +${Number(escort.surcharge || 0).toFixed(2)}
              </li>
            )}
            {attachmentWeight > 0 && (
              <li className="rounded-md bg-slate-800 px-2 py-1 font-semibold text-slate-200">
                Attachment weight included: {attachmentWeight.toLocaleString()} lbs
              </li>
            )}
          </ul>
        )}
      </header>

      {isDispatcherView && yardSuggestion}

      {!isDispatcherView && (
        <p role="note" className="m-0 rounded-xl bg-sunken px-4 py-3 text-sm leading-6 text-slate-300">
          <span className="font-semibold text-white">Estimate notice: </span>
          {companyRates?.client_portal?.disclosure || estimateDisclaimer}
        </p>
      )}

      {isDispatcherView && (
        <div className="space-y-2">
          <h3 className="m-0 text-sm font-semibold text-slate-200">Charges</h3>
          {hasCharges && (
            <div className="flex flex-wrap gap-2">
              {dispatcherSurcharges.map(({ key, active }) => (
                <button key={key} type="button" onClick={() => toggleOverride(key)} aria-pressed={Boolean(active)}
                  title={active ? 'Remove this charge from the quote' : 'Restore this charge'} className={chipClass(active)}>
                  <span>{key === 'metro' ? `Metro zone (${formatZoneCharge(metroCharge)})` : CHARGE_LABELS[key]}</span>
                  <Mark active={active} />
                </button>
              ))}
              {availableCustomSurcharges.map((item) => {
                const active = activeOverrides?.customSurcharges?.[item.id] === true;
                return (
                  <button key={item.id} type="button" onClick={() => toggleCustomSurcharge(item.id)} aria-pressed={active}
                    title={active ? 'Remove this charge from the quote' : 'Restore this charge'} className={chipClass(active)}>
                    <span>{item.name} ({item.feeType === 'percent' ? `+${item.value}%` : `+$${item.value}`})</span>
                    <Mark active={active} />
                  </button>
                );
              })}
            </div>
          )}
          {!hasAppliedSurcharges && <p className="m-0 text-sm text-slate-500">No surcharge add-ons applied</p>}
        </div>
      )}

      {isDispatcherView && (
        <div className="space-y-3">
          <button
            type="button"
            aria-expanded={showDetails}
            onClick={() => dispatch?.({ type: 'TOGGLE_DETAILS' })}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-sunken px-4 text-left text-[15px] font-semibold text-white transition hover:border-accent/60 hover:bg-raised cursor-pointer"
          >
            <span>{showDetails ? 'Hide trip breakdown' : 'Show trip breakdown'}</span>
            <ChevronDown aria-hidden="true" strokeWidth={2.5} className={`h-6 w-6 shrink-0 text-accent-text transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
          </button>
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

      {mapEmbedUrl && (
        <div className="h-52 w-full overflow-hidden rounded-xl bg-canvas">
          <iframe title="Route Map Preview" width="100%" height="100%" style={{ border: 0 }} loading="lazy" allowFullScreen src={mapEmbedUrl} />
        </div>
      )}

      <QuoteSaveForm state={state} dispatch={dispatch} isDispatcherView={isDispatcherView}
        onLogQuote={onLogQuote} onSaveForLater={onSaveForLater} onAcceptQuote={onAcceptQuote} />
    </section>
  );
}
