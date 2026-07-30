import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function QuoteLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white">Saved Quotes History</h2>
        <button
          onClick={fetchLogs}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
        >
          Refresh Log
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Loading history log...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No logged quotes found.</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            // Handle parsing surcharges (whether stored as JSON string or Array)
            let modifiers = [];
            if (Array.isArray(log.surcharges_applied)) {
              modifiers = log.surcharges_applied;
            } else if (typeof log.surcharges_applied === 'string') {
              try {
                modifiers = JSON.parse(log.surcharges_applied);
              } catch {
                modifiers = [];
              }
            }

            return (
              <div
                key={log.id}
                className="bg-[#0b0f17] border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs"
              >
                {/* Header info */}
                <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                  <div>
                    <span className="font-bold text-white text-sm">
                      {log.customer_name || 'Unnamed Customer'}
                    </span>
                    {log.customer_phone && log.customer_phone !== 'N/A' && (
                      <span className="text-slate-400 ml-2">({log.customer_phone})</span>
                    )}
                  </div>
                  <span className="text-slate-500 text-[11px]">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Base</span>
                    <span className="text-slate-200 font-medium">{log.base_location}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Quote Range</span>
                    <span className="text-emerald-400 font-bold">${log.quote_min} – ${log.quote_max}</span>
                  </div>
                </div>

                {/* Modifiers / Surcharges Badges */}
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                    Applied Modifiers
                  </span>
                  {modifiers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {modifiers.map((mod, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">None (Standard Rate)</span>
                  )}
                </div>

                {/* Route */}
                <div className="text-slate-400 pt-1 border-t border-slate-800/60">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Route</span>
                  <span className="text-slate-300">
                    {Array.isArray(log.waypoints) ? log.waypoints.join(' ➔ ') : log.waypoints}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}