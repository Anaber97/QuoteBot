const METERS_TO_MILES = 0.000621371;

/**
 * Re-prices a quote as if each other yard sent the truck and returns the yards that
 * would be cheaper, best first. Only the drive out and back changes between yards;
 * every yard's legs come from the same matrix, so the comparison is like for like.
 * `priceFor(quoteData)` returns the total the ticket would show for that quote.
 */
export function rankYards({ yards = [], currentYardId, quoteData, priceFor }) {
  const current = yards.find((yard) => yard.id === String(currentYardId));
  if (!current || !quoteData || typeof priceFor !== 'function') return [];
  const buffer = 1 + Number(quoteData.driveTimeBufferPercent || 0) / 100;
  const currentPrice = priceFor(quoteData);
  return yards
    .filter((yard) => yard.id !== current.id)
    .map((yard) => {
      const extraMinutes = (yard.outMinutes + yard.backMinutes) - (current.outMinutes + current.backMinutes);
      const extraMiles = ((yard.outMeters + yard.backMeters) - (current.outMeters + current.backMeters)) * METERS_TO_MILES;
      const price = priceFor({
        ...quoteData,
        rawTotalHours: Math.max(0, Number(quoteData.rawTotalHours || 0) + (extraMinutes * buffer) / 60),
        totalMiles: Math.max(0, Number(quoteData.totalMiles || 0) + extraMiles),
      });
      return { ...yard, price, savings: currentPrice - price, minutesSaved: Math.round(-extraMinutes), milesSaved: Math.round(-extraMiles) };
    })
    .filter((yard) => yard.savings > 0)
    .sort((a, b) => b.savings - a.savings || b.minutesSaved - a.minutesSaved);
}
