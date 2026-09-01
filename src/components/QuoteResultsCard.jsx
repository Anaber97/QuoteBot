// src/components/QuoteResultsCard.jsx
import React, { useState, useRef } from 'react';
import { calculateFinalQuotes } from '../services/quoteCalculator';
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

const formatChargeLabel = (label, feeType, value, defaultSuffix = '%') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return label;
  if (feeType === 'flat') return `${label} (+$${numericValue.toFixed(0)})`;
  const suffix = defaultSuffix || '%';
  const formatted = Number.isInteger(numericValue) ? numericValue.toFixed(0) : numericValue.toFixed(2);
  return `${label} (+${formatted}${suffix})`;
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
    customerName,
    customerPhone,
    isSaving,
    saveStatus,
  } = state || {};
  const [showAttachmentPrompt, setShowAttachmentPrompt] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef(null);
  const showDetails = Boolean(state?.showDetails);

  if (!quoteData) return null;

  const { currentMinQuote, currentMaxQuote, customCalculatedQuote } = calculateFinalQuotes(
    quoteData,
    activeOverrides,
    state?.customRateInput ?? state?.customRate ?? 0,
    companyRates,
    state?.customLoadUnloadMins ?? null
  );
  const permitFee = Number(quoteData?.equipmentMeta?.permitFee || quoteData?.permitFee || 0);
  const attachmentWeight = Number(quoteData?.equipmentMeta?.attachmentWeight || 0);
  const effectiveMinQuote = currentMinQuote + permitFee;
  const effectiveMaxQuote = currentMaxQuote + permitFee;
  const clientPrice = effectiveMinQuote;
  const isFixedEquipmentQuote = quoteData?.pricingMode === 'equipment-weight-tier';
  const isMileageQuote = quoteData?.pricingMode === 'mileage';
  const dispatcherSurcharges = [
    quoteData?.hasMetroZone ? { key: 'metro', active: activeOverrides?.metro } : null,
    quoteData?.hasHazardZone ? { key: 'hazard', active: activeOverrides?.hazard } : null,
    quoteData?.hasCustomZone ? { key: 'custom', active: true } : null,
  ].filter(Boolean);
  const appliedCustomSurcharges = (companyRates.pricing?.custom_surcharges || []).filter((item) => item.active !== false && activeOverrides?.customSurcharges?.[item.id] === true);
  const metroCodes = Array.isArray(quoteData?.metroCodes) && quoteData.metroCodes.length > 0 ? quoteData.metroCodes : [];
  const metroFeeMode = companyRates?.pricing?.surchargeModes?.metro_multiplier || companyRates?.surcharges?.surchargeModes?.metro_multiplier || 'percent';
  const metroFeeValue = companyRates?.pricing?.metro_multiplier ?? companyRates?.surcharges?.metro_multiplier ?? 28.57;
  const metroBadgeLabel = formatChargeLabel('Metro Zone', metroFeeMode, metroFeeValue);
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

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedAttachment(null);
      return;
    }

    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
      setAttachmentError('Please choose a PDF or image file.');
      setSelectedAttachment(null);
      return;
    }

    setSelectedAttachment(file);
    setAttachmentError('');
  };

  const handleAcceptQuote = () => {
    if (!showAttachmentPrompt) {
      setShowAttachmentPrompt(true);
      return;
    }

    onAcceptQuote?.({ attachmentFile: selectedAttachment || null });
    setShowAttachmentPrompt(false);
  };

  const handleSkipAttachment = () => {
    setShowAttachmentPrompt(false);
    setSelectedAttachment(null);
    setAttachmentError('');
    onAcceptQuote?.({ attachmentFile: null });
  };

  const handleLogQuote = () => {
    if (!showAttachmentPrompt) {
      setShowAttachmentPrompt(true);
      return;
    }
    onLogQuote?.({ attachmentFile: selectedAttachment || null });
    setShowAttachmentPrompt(false);
  };

  const toggleOverride = (key) => {
    dispatch?.({ type: 'SET_OVERRIDE', payload: { key, value: !activeOverrides?.[key] } });
  };

  return (
    <div
      ref={resultsRef}
      className="mt-6 lg:mt-0 bg-[#0c1019] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-5 transition-all min-w-0"
    >
      {/* 1. Price Range Display */}
      <div className="text-center space-y-1">
        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
          {isDispatcherView ? 'Estimated Total Quote' : 'Your Estimated Quote'}
        </span>
        {!isDispatcherView && <div className="text-4xl font-black text-white tracking-tight">${clientPrice}</div>}
        {isDispatcherView && isFixedEquipmentQuote && <div className="text-4xl font-black text-white tracking-tight">${clientPrice}</div>}
        <div className={`text-4xl font-black text-white tracking-tight ${isDispatcherView && !isFixedEquipmentQuote ? '' : 'hidden'}`}>
          ${effectiveMinQuote} <span className="text-slate-500 font-light">–</span> ${effectiveMaxQuote}
        </div>
        {isDispatcherView && isFixedEquipmentQuote && (
          <div className="text-[11px] text-slate-400">
            {quoteData.weightTierLabel || 'Equipment weight class'} · ${Number(quoteData.fixedHourlyRate).toFixed(0)}/hr
          </div>
        )}
        {isDispatcherView && permitFee > 0 && (
          <div className="inline-block bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs px-2.5 py-0.5 rounded-full mt-1">
            Permit surcharge included: +${permitFee.toFixed(2)}
          </div>
        )}
        {attachmentWeight > 0 && (
          <div className="inline-block bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold text-xs px-2.5 py-0.5 rounded-full mt-1">
            Attachment weight included: {attachmentWeight.toLocaleString()} lbs
          </div>
        )}
      </div>

      <p role="note" className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[11px] leading-5 text-slate-300">
        <span className="font-semibold text-blue-300">Estimate notice: </span>{estimateDisclaimer}
      </p>

      {isDispatcherView && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {dispatcherSurcharges.length > 0 ? dispatcherSurcharges.map(({ key, active }) => {
              const style = BADGE_STYLES[key];
              if (!style) return null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleOverride(key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${active ? style.active : style.disabled}`}
                  title={active ? 'Click to disable surcharge' : 'Click to restore surcharge'}
                >
                  <span>{key === 'metro' ? metroBadgeLabel : style.label}</span>
                  <span className="rounded bg-black/20 px-1 text-[10px] font-black leading-none opacity-80">
                    {active ? '✕' : '↺'}
                  </span>
                </button>
              );
            }) : (
              <span className="text-[10px] uppercase tracking-wide text-slate-500">No surcharge add-ons applied</span>
            )}
            {appliedCustomSurcharges.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold border-violet-500/30 bg-violet-500/10 text-violet-300">
                {item.name} ({item.feeType === 'percent' ? `+${item.value}%` : `+$${item.value}`})
              </span>
            ))}
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={() => dispatch?.({ type: 'TOGGLE_DETAILS' })}
              className="mt-3 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4 cursor-pointer transition"
            >
              {showDetails ? '▲ Hide Trip Breakdown' : '▼ Show Trip Breakdown'}
            </button>
          </div>

          {showDetails && routeLegs.length > 0 && (
            <div className="bg-[#080c14] border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs mb-5 shadow-inner text-left">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Route & {isMileageQuote ? 'Mileage' : 'Time'} Breakdown
              </h3>
              {routeLegs.map((leg, index) => (
                <div
                  key={`${leg.label}-${index}`}
                className="flex justify-between items-start gap-3 text-slate-400 pb-1.5 border-b border-slate-800/80"
                >
                  <span>{leg.label}</span>
                  <span className="font-semibold text-slate-200">{leg.minutes} mins</span>
                </div>
              ))}
              <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                <span>
                  Adjusted Drive Time (+{isFixedEquipmentQuote
                    ? Number(quoteData.driveTimeBufferPercent ?? 10)
                    : Number(companyRates?.pricing?.drive_time_buffer ?? 10)}%)
                </span>
                <span className="font-semibold text-slate-200">{Math.round(Number(quoteData?.adjustedDriveMin || 0))} mins</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                <span>Load / Unload Time</span>
                <span className="font-semibold text-slate-200">{Math.round(Number(quoteData?.loadUnloadTime || 0))} mins</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                <span>Municipality Code(s)</span>
                <span
                  className={`font-semibold ${
                    quoteData.hasMetroZone && activeOverrides?.metro
                      ? 'text-purple-400'
                      : 'text-slate-200'
                  }`}
                >
                  {metroCodes.length > 0 ? metroCodes.join(', ') : 'No'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                <span>Hazard Zone</span>
                <span
                  className={`font-semibold ${
                    quoteData.hasHazardZone && activeOverrides?.hazard
                      ? 'text-red-400'
                      : 'text-slate-200'
                  }`}
                >
                  {quoteData.hasHazardZone
                    ? activeOverrides?.hazard
                      ? 'Applied (+40%)'
                      : 'Removed (0%)'
                    : 'No'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                <span>{isFixedEquipmentQuote ? 'Base Equipment Price' : 'Base Price Range (No Surcharges)'}</span>
                <span className="font-semibold text-emerald-400">
                  {isFixedEquipmentQuote
                    ? `$${quoteData.baseMinQuote}`
                    : `$${quoteData.baseMinQuote} – $${quoteData.baseMaxQuote}`}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 text-sm font-bold text-white">
                <span>{isMileageQuote ? 'Total Billable Miles' : 'Total Billable Hours'}</span>
                <span className="text-blue-400">{isMileageQuote ? `${Number(quoteData.totalMiles || 0).toFixed(1)} mi` : `${quoteData.totalHours} hrs`}</span>
              </div>
            </div>
          )}
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

      {/* 3. Dispatcher-only controls */}
      {isDispatcherView && (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Custom {isMileageQuote ? 'Mileage' : 'Hourly'} Rate ({isMileageQuote ? '$/mi' : '$/hr'})
            </label>
            <input
              type="number"
              placeholder={`Override ${isMileageQuote ? 'mileage' : 'hourly'} rate...`}
              value={state?.customRateInput ?? ''}
              onChange={(e) => dispatch?.({ type: 'SET_CUSTOM_RATE', payload: e.target.value })}
              className="w-full rounded-xl border border-slate-800 bg-[#080c14] px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {!isMileageQuote && <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Custom Load / Unload Time (mins)</label>
            <input type="number" placeholder="Use class default" value={state?.customLoadUnloadMins ?? ''} onChange={(e) => dispatch?.({ type: 'SET_CUSTOM_LOAD_UNLOAD', payload: e.target.value })} className="w-full rounded-xl border border-slate-800 bg-[#080c14] px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>}
          {customCalculatedQuote !== null && customCalculatedQuote !== undefined && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300">
              Custom rate estimate: ${customCalculatedQuote}
            </div>
          )}
        </div>
      )}

      {/* 3. Save Form */}
      <div className="space-y-3 pt-2 border-t border-slate-800/60">
        {!isDispatcherView && companyRates?.client_portal?.disclosure && (
          <div className="rounded-xl border border-slate-800 bg-[#080c14] px-3 py-2 text-[11px] text-slate-400">
            <div className="font-semibold text-slate-300 mb-1">Quote Disclosure</div>
            <p>{companyRates.client_portal.disclosure}</p>
            <p className="mt-1 text-slate-500">
              Questions? Call {companyRates.client_portal.contact_phone || '(555) 555-0199'} or email {companyRates.client_portal.contact_email || 'quotes@yourcompany.com'}.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Contact Name"
            value={customerName}
            onChange={(e) =>
              dispatch({
                type: 'SET_CUSTOMER_INFO',
                payload: { field: 'customerName', value: e.target.value },
              })
            }
            className="bg-[#080c14] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Phone Number"
            value={customerPhone}
            onChange={(e) =>
              dispatch({
                type: 'SET_CUSTOMER_INFO',
                payload: { field: 'customerPhone', value: e.target.value },
              })
            }
            className="bg-[#080c14] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {isDispatcherView && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input type="text" placeholder="Equipment Make" value={state?.quoteMake ?? ''} onChange={(e) => dispatch?.({ type: 'SET_QUOTE_META_FIELDS', payload: { quoteMake: e.target.value } })} className="bg-[#080c14] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" placeholder="Equipment Model" value={state?.quoteModel ?? ''} onChange={(e) => dispatch?.({ type: 'SET_QUOTE_META_FIELDS', payload: { quoteModel: e.target.value } })} className="bg-[#080c14] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>}
        <textarea placeholder="Quote notes" value={state?.quoteNotes ?? ''} onChange={(e) => dispatch?.({ type: 'SET_QUOTE_META_FIELDS', payload: { quoteNotes: e.target.value } })} rows={3} className="w-full resize-y bg-[#080c14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />

        {quoteData?.approvalRequired && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
            This quote exceeds the approval threshold and has been flagged for manager review.
          </div>
        )}

        {onSaveForLater || onAcceptQuote ? (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {onSaveForLater && (
                <button
                  type="button"
                  onClick={onSaveForLater}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save for later'}
                </button>
              )}
              {onAcceptQuote && (
                <button
                  type="button"
                  onClick={handleAcceptQuote}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-50"
                >
                  {isSaving ? 'Submitting...' : 'Request Dispatch and Attach BOL'}
                </button>
              )}
            </div>
            {showAttachmentPrompt && (
              <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3 space-y-2 text-left">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Attach BOL (PDF or image, optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleAttachmentChange}
                  className="block w-full text-[11px] text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-300"
                />
                {attachmentError && <p className="text-[10px] text-red-400">{attachmentError}</p>}
                {selectedAttachment && <p className="text-[10px] text-emerald-400">Selected: {selectedAttachment.name}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptQuote}
                    className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipAttachment}
                    className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-300"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <button type="button" onClick={handleLogQuote} disabled={isSaving} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:bg-slate-800 cursor-pointer shadow-md">
              {isSaving ? 'Saving Quote...' : 'Save & Log Quote'}
            </button>
            {showAttachmentPrompt && (
              <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3 space-y-2 text-left">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Attach BOL (PDF or image, optional)</label>
                <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={handleAttachmentChange} className="block w-full text-[11px] text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-300" />
                {attachmentError && <p className="text-[10px] text-red-400">{attachmentError}</p>}
                {selectedAttachment && <p className="text-[10px] text-emerald-400">Selected: {selectedAttachment.name}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={handleLogQuote} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Log quote</button>
                  <button type="button" onClick={() => { setShowAttachmentPrompt(false); setSelectedAttachment(null); setAttachmentError(''); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {saveStatus && (
          <p
            className={`text-xs text-center font-semibold ${
              saveStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {saveStatus.message}
          </p>
        )}
      </div>

    </div>
  );
}
