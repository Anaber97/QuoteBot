import React from 'react';

/** Dispatcher-only trip details and per-quote pricing overrides. */
export default function QuoteTripBreakdown({
  state,
  dispatch,
  quoteData,
  activeOverrides,
  isMileageQuote,
  effectiveRate,
  timeMetrics,
  routeLegs,
  metroCodes,
  isFixedEquipmentQuote,
  effectiveBaseQuote,
  permitSurcharge,
  osow,
  osowFlagSummary,
  escort
}) {
  return (
    <div className="bg-[#080c14] border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs mb-5 shadow-inner text-left">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Route & {isMileageQuote ? 'Mileage' : 'Time'} Breakdown
              </h3>
              <div className="space-y-2 border-b border-slate-800/60 pb-3 mb-3 text-xs">
                {[
                  { label: isMileageQuote ? 'Mileage Rate' : 'Hourly Rate', value: effectiveRate, input: state?.customRateInput, action: 'SET_CUSTOM_RATE', prefix: '$', suffix: isMileageQuote ? '/mi' : '/hr', min: 0.01, max: 100000, step: '0.01' },
                  ...(!isMileageQuote ? [
                    { label: 'Drive Time Buffer', value: timeMetrics.driveTimeBufferPercent, input: state?.customDriveTimeBufferPercent, action: 'SET_CUSTOM_DRIVE_BUFFER', suffix: '%', min: 0, max: 1000, step: '0.1' },
                    { label: 'Load / Unload Time', value: timeMetrics.loadUnloadMinutes, input: state?.customLoadUnloadMins, action: 'SET_CUSTOM_LOAD_UNLOAD', suffix: 'mins', min: 0, max: 10080, step: '1' },
                  ] : []),
                ].map((field) => (
                  <label key={field.action} className="flex items-center justify-between gap-3 text-slate-400">
                    <span>{field.label}</span>
                    <span className="flex h-8 w-32 shrink-0 items-center gap-1.5 rounded-lg border border-slate-700/40 bg-white/[0.025] px-2.5 text-slate-200 transition-colors hover:border-slate-600/70 focus-within:border-blue-400/60 focus-within:bg-blue-400/5">
                      <span className="w-2 shrink-0 text-slate-500">{field.prefix}</span>
                      <input
                        aria-label={field.label}
                        title="Edit for this quote only; clear to use the default"
                        type="number" min={field.min} max={field.max} step={field.step}
                        value={field.input === '' ? '' : field.input ?? field.value}
                        placeholder={String(field.value)}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === '' || (Number(value) >= field.min && Number(value) <= field.max)) {
                            dispatch?.({ type: field.action, payload: value });
                          }
                        }}
                        className="min-w-0 w-full appearance-none bg-transparent text-right font-medium tabular-nums text-slate-200 placeholder:text-slate-200 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="w-7 shrink-0 text-right text-[10px] text-slate-500">{field.suffix}</span>
                    </span>
                  </label>
                ))}
                <p className="text-[10px] text-slate-500">Edit values for this quote only.</p>
              </div>
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
                  Adjusted Drive Time (+{timeMetrics.driveTimeBufferPercent}%)
                </span>
                <span className="font-semibold text-slate-200">{Math.round(timeMetrics.adjustedDriveMinutes)} mins</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                <span>Load / Unload Time</span>
                <span className="font-semibold text-slate-200">{Math.round(timeMetrics.loadUnloadMinutes)} mins</span>
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
                <span>{isFixedEquipmentQuote ? 'Base Equipment Price' : 'Base Price (No Surcharges)'}</span>
                <span className="font-semibold text-emerald-400">
                  ${effectiveBaseQuote}
                </span>
              </div>
              {permitSurcharge > 0 && <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                <span>{osow ? 'Permit / Escort Surcharge' : 'Weight Class Permit Cost'}</span>
                <span className="font-semibold text-amber-300">+${permitSurcharge.toFixed(2)}</span>
              </div>}
              {osowFlagSummary && <div className="flex justify-between items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-100">
                <span className="font-semibold">Permit flag</span>
                <span className="text-right font-bold text-amber-300">{osowFlagSummary.label} · {osowFlagSummary.states.join(', ')}</span>
              </div>}
        {!osow && Number(escort.vehicleCount) > 0 && <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800/80">
                <span>{escort.vehicleCount} Escort Vehicle{Number(escort.vehicleCount) === 1 ? '' : 's'}</span>
                <span className="font-semibold text-cyan-300">+${Number(escort.surcharge || 0).toFixed(2)}</span>
              </div>}
              <div className="flex justify-between items-center pt-1 text-sm font-bold text-white">
                <span>{isMileageQuote ? 'Total Billable Miles' : 'Total Billable Hours'}</span>
                <span className="text-blue-400">{isMileageQuote ? `${Number(quoteData.totalMiles || 0).toFixed(1)} mi` : `${Number(timeMetrics.rawTotalHours.toFixed(2))} hrs`}</span>
              </div>
            </div>
  );
}
