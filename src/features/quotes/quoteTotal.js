import { calculateFinalQuotes } from '../../services/quoteCalculator';

/** The total the quote ticket shows, with the dispatcher's per-quote overrides applied. */
export function quoteTotals(quoteData, state = {}, companyRates = {}, isDispatcherView = false) {
  const result = calculateFinalQuotes(
    quoteData,
    state.activeOverrides,
    state.customRateInput ?? state.customRate ?? 0,
    companyRates,
    state.customLoadUnloadMins ?? null,
    isDispatcherView,
    state.customDriveTimeBufferPercent ?? null
  );
  const permitFee = Number(quoteData?.equipmentMeta?.permitFee || quoteData?.permitFee || 0);
  const osow = quoteData?.osow || quoteData?.equipmentMeta?.osow;
  const total = !isDispatcherView && Number.isFinite(quoteData?.authoritativeTotal)
    ? quoteData.authoritativeTotal
    : (isDispatcherView ? result.customCalculatedQuote ?? result.currentMinQuote : result.currentMinQuote) + (osow ? 0 : permitFee);
  return { ...result, total, permitFee, osow };
}
