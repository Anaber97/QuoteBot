import React from 'react';

const Row = ({ label, children, tone = 'text-slate-200' }) => (
  <div className="flex items-start justify-between gap-3 py-2">
    <dt className="text-slate-400">{label}</dt>
    <dd className={`m-0 text-right font-semibold tabular-nums ${tone}`}>{children}</dd>
  </div>
);

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
  escort,
  overnights
}) {
  const fields = [
    { label: isMileageQuote ? 'Mileage Rate' : 'Hourly Rate', value: effectiveRate, input: state?.customRateInput, action: 'SET_CUSTOM_RATE', prefix: '$', suffix: isMileageQuote ? '/mi' : '/hr', min: 0.01, max: 100000, step: '0.01' },
    ...(!isMileageQuote ? [
      { label: 'Drive Time Buffer', value: timeMetrics.driveTimeBufferPercent, input: state?.customDriveTimeBufferPercent, action: 'SET_CUSTOM_DRIVE_BUFFER', suffix: '%', min: 0, max: 1000, step: '0.1' },
      { label: 'Load / Unload Time', value: timeMetrics.loadUnloadMinutes, input: state?.customLoadUnloadMins, action: 'SET_CUSTOM_LOAD_UNLOAD', suffix: 'min', min: 0, max: 10080, step: '1' },
    ] : []),
  ];

  return (
    <div className="space-y-5 rounded-xl bg-sunken p-4 text-sm">
      <fieldset className="m-0 space-y-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold text-slate-200">This quote only</legend>
        {fields.map((field) => (
          <label key={field.action} className="flex items-center justify-between gap-3 text-slate-400">
            <span>{field.label}</span>
            <span className="flex h-10 w-36 shrink-0 items-center gap-1.5 rounded-lg border border-slate-800 bg-canvas px-3 text-slate-200 focus-within:border-accent">
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
                className="min-w-0 w-full appearance-none bg-transparent text-right font-semibold tabular-nums text-slate-200 placeholder:text-slate-200 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="w-8 shrink-0 text-right text-slate-500">{field.suffix}</span>
            </span>
          </label>
        ))}
        <p className="m-0 text-xs text-slate-500">Clear a field to go back to your settings.</p>
      </fieldset>

      <dl className="m-0 divide-y divide-slate-800">
        {routeLegs.map((leg, index) => (
          <Row key={`${leg.label}-${index}`} label={leg.label}>{leg.minutes} min</Row>
        ))}
        <Row label={`Adjusted drive time (+${timeMetrics.driveTimeBufferPercent}%)`}>{Math.round(timeMetrics.adjustedDriveMinutes)} min</Row>
        <Row label="Load / unload time">{Math.round(timeMetrics.loadUnloadMinutes)} min</Row>
        <Row label="Municipality code(s)" tone={quoteData.hasMetroZone && activeOverrides?.metro ? 'text-accent-text' : 'text-slate-200'}>
          {metroCodes.length > 0 ? metroCodes.join(', ') : 'No'}
        </Row>
        <Row label="Hazard zone" tone={quoteData.hasHazardZone && activeOverrides?.hazard ? 'text-accent-text' : 'text-slate-200'}>
          {quoteData.hasHazardZone ? (activeOverrides?.hazard ? 'Applied (+40%)' : 'Removed (0%)') : 'No'}
        </Row>
        <Row label={isFixedEquipmentQuote ? 'Base equipment price' : 'Base price (no surcharges)'}>${effectiveBaseQuote}</Row>
        {permitSurcharge > 0 && (
          <Row label={osow ? 'Permit / escort surcharge' : 'Weight class permit cost'} tone="text-amber-300">+${permitSurcharge.toFixed(2)}</Row>
        )}
        {!osow && Number(escort.vehicleCount) > 0 && (
          <Row label={`${escort.vehicleCount} escort vehicle${Number(escort.vehicleCount) === 1 ? '' : 's'}`}>+${Number(escort.surcharge || 0).toFixed(2)}</Row>
        )}
        {overnights && (overnights.driver > 0 || overnights.escorts.some(Boolean)) && (
          <Row label={`Overnights: driver ${overnights.driver}${overnights.escorts.length ? `, escort${overnights.escorts.length === 1 ? '' : 's'} ${overnights.escorts.join(' + ')}` : ''}`}>+${Number(overnights.charge || 0).toFixed(2)}</Row>
        )}
        <Row label={isMileageQuote ? 'Total billable miles' : 'Total billable hours'} tone="text-white">
          {isMileageQuote ? `${Number(quoteData.totalMiles || 0).toFixed(1)} mi` : `${Number(timeMetrics.rawTotalHours.toFixed(2))} h`}
        </Row>
      </dl>

      {osowFlagSummary && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-100">
          <span className="font-semibold">Permit flag</span>
          <span className="text-right font-bold text-amber-300">{osowFlagSummary.label} · {osowFlagSummary.states.join(', ')}</span>
        </div>
      )}
      {(osow?.states || []).filter((row) => row.needsPermit && row.notes?.length).map((row) => (
        <section key={row.state} aria-label={`${row.state} permit notes`} className="space-y-2 rounded-lg bg-amber-500/5 p-3 text-slate-300">
          <h4 className="m-0 font-bold text-amber-300">{row.state}: {[...(row.reasons || []), ...(row.triggers || [])].join(', ')}</h4>
          {row.notes.map((note, index) => <p key={index} className="m-0">{note}</p>)}
          <p className="m-0 text-xs text-slate-400">Dispatch review guidance{row.sourceAgency ? ` · ${row.sourceAgency}` : ''}{row.retrievedAt ? ` · ${row.retrievedAt}` : ''}</p>
          {/^https?:\/\//i.test(row.sourceUrl || '') && <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent-text underline">State source</a>}
        </section>
      ))}
      {(osow?.states || []).some((row) => row.skippedChecks?.length) && <p className="m-0 text-xs text-slate-400">Length and overhang are checked only when supplied; omitted measurements are not assessed.</p>}
      {osow?.reviewRequired && (
        <div className="text-amber-200" role="note">
          <p className="m-0 font-semibold">OSOW review needed</p>
          <ul className="m-0 pl-5">{(osow.reviewReasons || []).map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
