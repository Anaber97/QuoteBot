import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function QuoteLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search filter states
  const [searchTerm, setSearchTerm] = useState('');

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

  // Filter logs locally based on customer name, phone, or route addresses
  const filteredLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true;

    const query = searchTerm.toLowerCase();
    const nameMatch = (log.customer_name || '').toLowerCase().includes(query);
    const phoneMatch = (log.customer_phone || '').toLowerCase().includes(query);
    const baseMatch = (log.base_location || '').toLowerCase().includes(query);

    let addressMatch = false;
    if (Array.isArray(log.waypoints)) {
      addressMatch = log.waypoints.some((wp) => wp.toLowerCase().includes(query));
    } else if (typeof log.waypoints === 'string') {
      addressMatch = log.waypoints.toLowerCase().includes(query);
    }

    return nameMatch || phoneMatch || baseMatch || addressMatch;
  });

  return (
    <div className="space-y-4">
      {/* Header & Search Bar Controls */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Saved Quotes History</h2>
          <button
            onClick={fetchLogs}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
          >
            Refresh
          </button>
        </div>

        {/* Search Input Field */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by customer name, phone, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b0f17] border border-slate-700/80 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white font-bold text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Loading history log...</p>
      ) : filteredLogs.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          {searchTerm ? `No quotes matching "${searchTerm}"` : 'No logged quotes found.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
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
                {/* Customer & Timestamp */}
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

                {/* Base & Quote Details */}
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

                {/* Modifiers / Surcharges */}
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

                {/* Route Waypoints */}
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