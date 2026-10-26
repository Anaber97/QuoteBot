import React from 'react';

/** Offers the cheapest other yard for this route, when one would cost the customer less. */
export default function YardSuggestion({ suggestion, onSwitch, busy = false }) {
  if (!suggestion) return null;
  const minutes = suggestion.minutesSaved > 0 ? ` · ${suggestion.minutesSaved} min less driving` : '';
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
      <p className="m-0 min-w-0 flex-1 text-sm text-slate-200">
        <span className="font-semibold text-white">{suggestion.name}</span> would quote{' '}
        <span className="font-semibold text-accent-text">${Math.round(suggestion.savings).toLocaleString('en-US')} less</span>{minutes}.
      </p>
      <button
        type="button"
        onClick={() => onSwitch?.(suggestion.id)}
        disabled={busy}
        className="min-h-10 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition hover:bg-accent-strong disabled:opacity-50"
      >
        {busy ? 'Re-quoting…' : `Quote from ${suggestion.name}`}
      </button>
    </div>
  );
}
