import React, { lazy, Suspense } from 'react';
import SurchargeToggles from '../../components/SurchargeToggles';
import WaypointList from '../../components/WaypointList';
import QuoteResultsCard from '../../components/QuoteResultsCard';

const ClientQuoteForm = lazy(() => import('../../components/ClientQuoteForm'));
const LoadingPanel = () => <div className="p-8 text-center text-sm text-slate-400" role="status">Loading…</div>;

const selectClass = 'min-h-11 w-full cursor-pointer rounded-lg border border-slate-800 bg-canvas px-3 text-[15px] font-medium text-white focus:border-accent focus:outline-none';

function Step({ title, children, aside = null }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold text-slate-200">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Dispatcher and manager quoting workspace: the job on the left, the quote ticket on the right. */
export default function DispatchCalculator({
  state,
  dispatch,
  companyRates,
  bases,
  currentBase,
  truckClasses,
  quoteData,
  loading,
  error,
  showEquipmentCalculator,
  onShowEquipmentCalculator,
  onCalculate,
  onEquipmentCalculate,
  onReset,
  openedLoggedQuote,
  onLogQuote,
  resultsRef,
  yardSuggestion,
}) {
  const yardName = currentBase?.name || 'yard';
  const modes = [
    { equipment: false, label: 'Towing' },
    { equipment: true, label: 'Equipment' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="m-0 text-2xl font-extrabold tracking-tight text-white">New quote</h2>
        <div role="group" aria-label="Quote type" className="inline-flex gap-1 rounded-lg border border-slate-800 bg-canvas p-1">
          {modes.map((mode) => (
            <button
              key={mode.label}
              type="button"
              aria-pressed={showEquipmentCalculator === mode.equipment}
              onClick={() => onShowEquipmentCalculator(mode.equipment)}
              className={`min-h-9 rounded-md px-4 text-sm font-semibold transition cursor-pointer ${showEquipmentCalculator === mode.equipment ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 rounded-2xl border border-slate-800 bg-panel p-5 sm:p-6 lg:col-span-5">
          {error && (
            <div role="alert" className="mb-5 rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>
          )}

          {showEquipmentCalculator ? (
            <Suspense fallback={<LoadingPanel />}>
              <ClientQuoteForm companyRates={companyRates} onCalculate={onEquipmentCalculate} isCalculating={loading} title="Equipment Calculator" isDispatcherView onReset={onReset} initialQuote={openedLoggedQuote} />
            </Suspense>
          ) : (
            <form onSubmit={onCalculate} className="space-y-7">
              <Step title="Dispatch from">
                {bases.length === 0 && <p className="m-0 text-sm text-amber-300">Add a yard in Settings before quoting.</p>}
                {bases.length > 0 && bases.length <= 4 && (
                  <div role="group" aria-label="Base dispatch location" className="flex flex-wrap gap-2">
                    {bases.map((base) => {
                      const active = String(currentBase?.id) === String(base.id);
                      return (
                        <button
                          key={base.id}
                          type="button"
                          aria-pressed={active}
                          title={base.address}
                          onClick={() => dispatch({ type: 'SET_BASE', payload: base.id })}
                          className={`min-h-10 rounded-lg border px-3.5 text-sm font-semibold transition cursor-pointer ${active ? 'border-accent bg-accent/10 text-white' : 'border-slate-800 text-slate-300 hover:border-slate-700'}`}
                        >
                          {base.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {bases.length > 4 && (
                  <select aria-label="Base dispatch location" value={state.selectedBaseId} onChange={(e) => dispatch({ type: 'SET_BASE', payload: e.target.value })} className={selectClass}>
                    {bases.map((base) => <option key={base.id} value={base.id}>{base.name} ({base.address})</option>)}
                  </select>
                )}
              </Step>

              <Step title="Truck">
                <select aria-label="Tow vehicle class" value={state.selectedTruckClassId} onChange={(e) => dispatch({ type: 'SET_TRUCK_CLASS', payload: e.target.value })} className={selectClass}>
                  <option value="">Standard tow / flatbed · ${companyRates?.pricing?.hourly_min || 125}/h</option>
                  {truckClasses.map((cls) => <option key={cls.id} value={cls.id}>{cls.name} · ${cls.minRate}/h</option>)}
                </select>
              </Step>

              <Step title="Route">
                <WaypointList
                  waypoints={Array.isArray(state.waypoints) ? state.waypoints : ['', '']}
                  inputRefs={{ current: [] }}
                  yardName={yardName}
                  onChange={(index, value) => dispatch({ type: 'UPDATE_WAYPOINT', payload: { index, value } })}
                  onRemove={(index) => dispatch({ type: 'REMOVE_WAYPOINT', payload: index })}
                  onAdd={() => dispatch({ type: 'ADD_WAYPOINT' })}
                  onReset={onReset}
                />
              </Step>

              <Step title="Charges">
                <SurchargeToggles state={state} dispatch={dispatch} companyRates={companyRates} />
              </Step>

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent text-base font-bold text-accent-ink transition hover:bg-accent-strong disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Calculating Route...' : 'Calculate Quote'}
              </button>
            </form>
          )}
        </div>

        <div className="min-w-0 lg:sticky lg:top-24 lg:col-span-7">
          {quoteData ? (
            <QuoteResultsCard
              state={{ ...state, activeOverrides: state.activeOverrides, quoteData, customRate: state.customRateInput }}
              dispatch={dispatch}
              resultsRef={resultsRef}
              onLogQuote={onLogQuote}
              companyRates={companyRates}
              isDispatcherView
              yardSuggestion={yardSuggestion}
            />
          ) : (
            <section aria-labelledby="quote-empty-title" className="rounded-2xl border border-slate-800 bg-panel p-6">
              <h2 id="quote-empty-title" className="m-0 text-sm font-semibold text-slate-400">Quote</h2>
              <div aria-hidden="true" className="mt-2 text-6xl font-extrabold leading-none tracking-tight text-slate-800">$—</div>
              <p className="m-0 mt-4 max-w-md text-sm text-slate-400">
                Enter a pickup and press <strong className="text-slate-200">Calculate Quote</strong>. The price, trip breakdown and, with more than one yard, the cheapest yard for the job appear here.
              </p>
            </section>
          )}
          <p className="m-0 mt-4 text-xs text-slate-400">
            Quotes are electronically generated estimates and may contain occasional inaccuracies. Final pricing should be confirmed before dispatch.
          </p>
        </div>
      </div>
    </div>
  );
}
