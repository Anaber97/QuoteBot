import React from 'react';

const minutesLabel = (minutes) => {
  const rounded = Math.round(minutes);
  return rounded >= 60 ? `${Math.floor(rounded / 60)} h ${String(rounded % 60).padStart(2, '0')} m` : `${rounded} min`;
};

/**
 * The billable time as one bar: the drive out from the yard, time on site, the loaded
 * run and the drive back. Built from the route legs the quote already has.
 */
export default function TimeRibbon({ legs = [], loadUnloadMinutes = 0, bufferPercent = 0 }) {
  if (legs.length < 2) return null;
  const buffer = 1 + Number(bufferPercent || 0) / 100;
  const drive = (leg) => Number(leg?.minutes || 0) * buffer;
  const segments = [
    { key: 'out', name: 'To pickup', minutes: drive(legs[0]), tone: 'bg-slate-700' },
    { key: 'site', name: 'On site', minutes: Number(loadUnloadMinutes || 0), tone: 'bg-slate-500' },
    { key: 'loaded', name: 'Loaded', minutes: legs.slice(1, -1).reduce((sum, leg) => sum + drive(leg), 0), tone: 'bg-accent' },
    { key: 'back', name: 'Back to yard', minutes: drive(legs.at(-1)), tone: 'bg-slate-700' },
  ].filter((segment) => segment.minutes > 0);
  const total = segments.reduce((sum, segment) => sum + segment.minutes, 0) || 1;

  return (
    <figure className="m-0 space-y-2">
      <figcaption className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-200">Where the time goes</span>
        <span className="tabular-nums text-slate-400">{minutesLabel(total)}</span>
      </figcaption>
      <div role="img" aria-label={segments.map((segment) => `${segment.name} ${minutesLabel(segment.minutes)}`).join(', ')} className="flex h-10 gap-0.5 overflow-hidden rounded-lg">
        {segments.map((segment) => (
          <div key={segment.key} className={segment.tone} style={{ flex: `${segment.minutes} 1 0`, minWidth: 6 }} />
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-0.5">
        {segments.map((segment) => (
          <div key={segment.key} className="min-w-0 overflow-hidden" style={{ flex: `${segment.minutes} 1 0`, minWidth: 6 }}>
            {segment.minutes / total > 0.12 && <>
              <div className="truncate text-xs text-slate-400">{segment.name}</div>
              <div className="truncate text-sm font-semibold tabular-nums text-slate-200">{minutesLabel(segment.minutes)}</div>
            </>}
          </div>
        ))}
      </div>
    </figure>
  );
}
