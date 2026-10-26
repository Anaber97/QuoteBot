import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../../lib/api';

/** Drive legs from every yard for the quoted route; empty with fewer than two yards. */
export function useYardComparison({ waypoints, yardCount, enabled }) {
  const routeKey = enabled && yardCount >= 2 && Array.isArray(waypoints) && waypoints.length > 0
    ? JSON.stringify([waypoints[0], waypoints.at(-1)])
    : '';
  const [result, setResult] = useState({ routeKey: '', yards: [] });

  useEffect(() => {
    if (!routeKey) return undefined;
    let cancelled = false;
    const [pickup, dropoff] = JSON.parse(routeKey);
    authenticatedFetch('/api/createQuote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compareYards: true, waypoints: [pickup, dropoff] }),
    })
      .then((response) => response.json().then((body) => (response.ok ? body.yards : [])))
      // A failed comparison only hides the suggestion; the quote itself is unaffected.
      .catch(() => [])
      .then((yards) => { if (!cancelled) setResult({ routeKey, yards: Array.isArray(yards) ? yards : [] }); });
    return () => { cancelled = true; };
  }, [routeKey]);

  return result.routeKey === routeKey ? result.yards : [];
}
