import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function QuoteLog({ onSelectQuote }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('quote_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-500 rounded-full mb-2" />
        <p>Loading saved quotes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs font-medium">
        Failed to load quote log: {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
        <p className="text-sm font-semibold text-slate-400 mb-1">No Quotes Logged Yet 📊</p>
        <p className="text-xs">Calculated quotes saved to database will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
      {logs.map((log) => (
        <div key={log.id} className="bg-[#0b0f17] border border-slate-800 rounded-xl p-4 text-xs space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-bold text-white text-sm">{log.customer_name || 'N/A'}</span>
              <span className="block text-slate-500 text-[10px]">{log.customer_phone || 'No phone'}</span>
            </div>
            <span className="font-extrabold text-emerald-400 text-sm">${log.min_quote} – ${log.max_quote}</span>
          </div>

          <div className="text-slate-400 space-y-0.5">
            <p><strong className="text-slate-300">Base:</strong> {log.base_yard_id || 'N/A'}</p>
            <p><strong className="text-slate-300">Waypoints:</strong> {Array.isArray(log.all_waypoints) ? log.all_waypoints.join(' ➔ ') : 'N/A'}</p>
            <p><strong className="text-slate-300">Hours:</strong> {Number(log.total_hours || 0).toFixed(2)} hrs</p>
          </div>

          {log.applied_surcharges && Object.entries(log.applied_surcharges).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {Object.entries(log.applied_surcharges)
                .filter(([, active]) => Boolean(active))
                .map(([key]) => (
                  <span key={key} className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                    {key}
                  </span>
                ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => onSelectQuote && onSelectQuote(log)}
            className="mt-2 w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded-lg font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            📂 Open in Calculator
          </button>
        </div>
      ))}
    </div>
  );
}
