// src/components/QuoteResultsCard.jsx
import React from 'react';
import { calculateFinalQuotes } from '../services/quoteCalculator';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Distinct surcharge badge styling
const BADGE_STYLES = {
  afterHours: {
    active: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    disabled: 'bg-slate-900/60 border-slate-800 text-slate-500 line-through',
    label: 'After Hours (+25%)',
  },
  roadClub: {
    active: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300',
    disabled: 'bg-slate-900/60 border-slate-800 text-slate-500 line-through',
    label: 'Road Club (+15%)',
  },
  metro: {
    active: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
    disabled: 'bg-slate-900/60 border-slate-800 text-slate-500 line-through',
    label: 'Metro Zone (+28.57%)',
  },
  hazard: {
    active: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
    disabled: 'bg-slate-900/60 border-slate-800 text-slate-500 line-through',
    label: 'Hazard Zone (+40%)',
  },
};

export default function QuoteResultsCard({
  state,
  dispatch,
  resultsRef,
  onLogQuote,
}) {
  const {
    quoteData,
    activeOverrides,
    showDetails,
    customRate,
    customerName,
    customerPhone,
    isSaving,
    saveStatus,
  } = state;

  if (!quoteData) return null;

  const { currentMinQuote, currentMaxQuote, customCalculatedQuote } = calculateFinalQuotes(
    quoteData,
    activeOverrides,
    customRate
  );

  const toggleOverride = (key) => {
    dispatch({ type: 'TOGGLE_OVERRIDE', payload: key });
  };

  // Build valid Google Maps Embed URL using clean waypoints
  const waypoints = quoteData.cleanWaypoints || [];
  const origin = encodeURIComponent(waypoints[0] || '');
  const destination = encodeURIComponent(waypoints[waypoints.length - 1] || '');
  const intermediateWaypoints = waypoints
    .slice(1, -1)
    .map((wp) => encodeURIComponent(wp))
    .join('|');

  const mapEmbedUrl =
    waypoints.length >= 2 && GOOGLE_MAPS_API_KEY
      ? `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${origin}&destination=${destination}${
          intermediateWaypoints ? `&waypoints=${intermediateWaypoints}` : ''
        }&mode=driving`
      : null;

  // Standard surcharges (Heavy Duty excluded)
  const surcharges = [
    quoteData.hasAfterHours && { key: 'afterHours', active: activeOverrides.afterHours },
    quoteData.hasRoadClub && { key: 'roadClub', active: activeOverrides.roadClub },
    quoteData.hasMetroZone && { key: 'metro', active: activeOverrides.metro },
    quoteData.hasHazardZone && { key: 'hazard', active: activeOverrides.hazard },
  ].filter(Boolean);

  return (
    <div
      ref={resultsRef}
      className="mt-6 bg-[#0c1019] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5 transition-all"
    >
      {/* 1. Price Range Display */}
      <div className="text-center space-y-1">
        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
          Estimated Total Quote
        </span>
        <div className="text-4xl font-black text-white tracking-tight">
          ${currentMinQuote} <span className="text-slate-500 font-light">–</span> ${currentMaxQuote}
        </div>
        {customCalculatedQuote && (
          <div className="inline-block bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs px-2.5 py-0.5 rounded-full mt-1">
            Custom Rate: ${customCalculatedQuote}
          </div>
        )}
      </div>

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

      {/* 3. Interactive Surcharge Badges */}
      {surcharges.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          {surcharges.map(({ key, active }) => {
            const style = BADGE_STYLES[key];
            if (!style) return null;

            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleOverride(key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                  active ? style.active : style.disabled
                }`}
                title={active ? 'Click to disable surcharge' : 'Click to restore surcharge'}
              >
                <span>{style.label}</span>
                <span className="text-[10px] font-black opacity-80 bg-black/20 rounded px-1">
                  {active ? '✕' : '↺'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Trip Breakdown Accordion */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => dispatch({ type: 'TOGGLE_DETAILS' })}
          className="mt-3 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4 cursor-pointer transition"
        >
          {showDetails ? '▲ Hide Trip Breakdown' : '▼ Show Trip Breakdown'}
        </button>
      </div>

      {showDetails && (
        <div className="bg-[#080c14] border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs mb-5 shadow-inner text-left">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Route & Time Breakdown
          </h3>
          {quoteData.legsDetails?.map((leg, i) => (
            <div
              key={i}
              className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80"
            >
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
            <span>Metro Zone</span>
            <span
              className={`font-semibold ${
                quoteData.hasMetroZone && activeOverrides.metro
                  ? 'text-purple-400'
                  : 'text-slate-200'
              }`}
            >
              {quoteData.hasMetroZone
                ? activeOverrides.metro
                  ? 'Applied (+28.57%)'
                  : 'Removed (0%)'
                : 'No'}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
            <span>Hazard Zone</span>
            <span
              className={`font-semibold ${
                quoteData.hasHazardZone && activeOverrides.hazard
                  ? 'text-red-400'
                  : 'text-slate-200'
              }`}
            >
              {quoteData.hasHazardZone
                ? activeOverrides.hazard
                  ? 'Applied (+40%)'
                  : 'Removed (0%)'
                : 'No'}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
            <span>Base Price Range (No Surcharges)</span>
            <span className="font-semibold text-emerald-400">
              ${quoteData.baseMinQuote} – ${quoteData.baseMaxQuote}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 text-sm font-bold text-white">
            <span>Total Billable Hours</span>
            <span className="text-blue-400">{quoteData.totalHours} hrs</span>
          </div>
        </div>
      )}

      {/* 5. Custom Rate & Save Form */}
      <div className="space-y-3 pt-2 border-t border-slate-800/60">
        <div>
          <label className="block text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400 mb-1">
            Custom Hourly Rate ($/hr)
          </label>
          <input
            type="number"
            placeholder="Override hourly rate..."
            value={customRate}
            onChange={(e) => dispatch({ type: 'SET_CUSTOM_RATE', payload: e.target.value })}
            className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Customer Name"
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

        <button
          type="button"
          onClick={onLogQuote}
          disabled={isSaving}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:bg-slate-800 cursor-pointer shadow-md"
        >
          {isSaving ? 'Saving Quote...' : 'Save & Log Quote'}
        </button>

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