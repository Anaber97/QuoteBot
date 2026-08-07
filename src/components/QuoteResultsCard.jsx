// src/components/QuoteResultsCard.jsx
import React from 'react';
import { calculateFinalQuotes } from '../services/quoteCalculator';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Distinct surcharge badge styling
export default function QuoteResultsCard({
  state,
  dispatch,
  resultsRef,
  onLogQuote,
  companyRates = {},
}) {
  const {
    quoteData,
    activeOverrides,
    customerName,
    customerPhone,
    isSaving,
    saveStatus,
  } = state || {};

  if (!quoteData) return null;

  const { currentMinQuote, currentMaxQuote } = calculateFinalQuotes(
    quoteData,
    activeOverrides,
    0,
    companyRates
  );
  const permitFee = Number(quoteData?.equipmentMeta?.permitFee || quoteData?.permitFee || 0);
  const attachmentWeight = Number(quoteData?.equipmentMeta?.attachmentWeight || 0);
  const attachmentAdjustment = attachmentWeight > 0 ? Math.min(10000, Math.max(5000, Math.round(attachmentWeight * 0.6))) : 0;
  const effectiveMinQuote = currentMinQuote + permitFee + attachmentAdjustment;
  const effectiveMaxQuote = currentMaxQuote + permitFee + attachmentAdjustment;

  // Build a Google Maps Embed URL for the full base-to-base route with intermediate stops.
  const routeAddresses = Array.isArray(quoteData.routeAddresses) && quoteData.routeAddresses.length > 0
    ? quoteData.routeAddresses
    : [quoteData.baseAddress, ...(quoteData.cleanWaypoints || []), quoteData.baseAddress].filter(Boolean);

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
          ${effectiveMinQuote} <span className="text-slate-500 font-light">–</span> ${effectiveMaxQuote}
        </div>
        {permitFee > 0 && (
          <div className="inline-block bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs px-2.5 py-0.5 rounded-full mt-1">
            Permit surcharge included: +${permitFee.toFixed(2)}
          </div>
        )}
        {attachmentWeight > 0 && (
          <div className="inline-block bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold text-xs px-2.5 py-0.5 rounded-full mt-1">
            Attachment impact applied: +${attachmentAdjustment.toFixed(2)}
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

      {/* 3. Save Form */}
      <div className="space-y-3 pt-2 border-t border-slate-800/60">
        {companyRates?.client_portal?.disclosure && (
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

        {quoteData?.approvalRequired && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
            This quote exceeds the approval threshold and has been flagged for manager review.
          </div>
        )}

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