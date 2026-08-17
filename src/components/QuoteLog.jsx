import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { authenticatedFetch } from '../lib/api';

const allowedBol = (file) => file && (['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.name.toLowerCase().endsWith('.pdf'));
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const quoteHtml = (log) => `<!doctype html><html><head><title>Quote ${escapeHtml(log.id)}</title><style>body{font-family:Arial,sans-serif;color:#172033;max-width:760px;margin:40px auto}h1{margin-bottom:4px}.price{font-size:28px;font-weight:700;color:#047857}.row{padding:10px 0;border-bottom:1px solid #ddd}small{color:#667085}@media print{button{display:none}}</style></head><body><h1>Transport Quote</h1><small>${escapeHtml(new Date(log.created_at).toLocaleString())}</small><p class="price">$${escapeHtml(log.min_quote)} – $${escapeHtml(log.max_quote)}</p><div class="row"><b>Customer:</b> ${escapeHtml(log.customer_name || 'N/A')}</div><div class="row"><b>Phone:</b> ${escapeHtml(log.customer_phone || 'N/A')}</div><div class="row"><b>Route:</b> ${escapeHtml((log.all_waypoints || []).join(' → '))}</div><div class="row"><b>Miles:</b> ${Number(log.total_miles || 0).toFixed(1)}</div><div class="row"><b>Hours:</b> ${Number(log.total_hours || 0).toFixed(2)}</div><button onclick="window.print()">Print / Save as PDF</button></body></html>`;

export default function QuoteLog({ onSelectQuote, profile }) {
  const [logs, setLogs] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null); const [shareId, setShareId] = useState(null);
  const fileRef = useRef(null); const pendingQuoteRef = useRef(null); const isClientPortal = profile?.role === 'client';

  const fetchLogs = useCallback(async () => {
    setLoading(true); setError(null);
    let query = supabase.from('quote_logs').select('*').order('created_at', { ascending: false });
    if (isClientPortal) query = query.eq('quote_source', 'client_portal').eq('client_id', profile.client_id);
    const { data, error: loadError } = await query;
    if (loadError) setError(loadError.message); else setLogs(data || []); setLoading(false);
  }, [isClientPortal, profile?.client_id]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const callEmail = async (log, action, recipient = null) => {
    setBusyId(log.id);
    try {
      const response = await authenticatedFetch('/api/sendQuoteEmail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: log.id, action, recipient }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Email could not be sent.');
      alert(action === 'share' ? 'Quote emailed.' : action === 'bol_attached' ? 'BOL attached and dispatch notified.' : 'Quote sent for dispatch.');
    } catch (emailError) { alert(emailError.message); } finally { setBusyId(null); }
  };
  const savePdf = (log) => { const win = window.open('', '_blank'); if (!win) return alert('Please allow pop-ups to save the quote as a PDF.'); win.document.write(quoteHtml(log)); win.document.close(); win.focus(); setTimeout(() => win.print(), 150); };
  const attachBol = (log) => { pendingQuoteRef.current = log; fileRef.current?.click(); };
  const handleBolFile = async (event) => {
    const file = event.target.files?.[0]; const log = pendingQuoteRef.current; event.target.value = ''; if (!log || !file) return;
    if (!allowedBol(file)) return alert('Choose a PDF, PNG, JPG, or WebP file.'); setBusyId(log.id);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${profile.company_id}/${log.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('quote-bols').upload(path, file, { contentType: file.type, upsert: false }); if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('quote_logs').update({ bol_path: path, bol_name: file.name, bol_type: file.type }).eq('id', log.id); if (updateError) throw updateError;
      await callEmail(log, 'bol_attached'); await fetchLogs();
    } catch (uploadError) { alert(uploadError.message); setBusyId(null); }
  };
  const openBol = async (log) => { const { data, error: signError } = await supabase.storage.from('quote-bols').createSignedUrl(log.bol_path, 60); if (signError) return alert(signError.message); window.open(data.signedUrl, '_blank', 'noopener,noreferrer'); };

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm"><div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-500 rounded-full mb-2" /><p>Loading saved quotes...</p></div>;
  if (error) return <div className="p-4 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs font-medium">Failed to load quote log: {error}</div>;
  if (!logs.length) return <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl"><p className="text-sm font-semibold text-slate-400 mb-1">No Quotes Logged Yet 📊</p><p className="text-xs">Saved quotes will appear here.</p></div>;

  return <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1"><input ref={fileRef} type="file" hidden accept="application/pdf,image/png,image/jpeg,image/webp" onChange={handleBolFile} />
    {logs.map((log) => {
      const isClientQuote = log.quote_source === 'client_portal';
      const equipment = log.quote_details && typeof log.quote_details === 'object' ? log.quote_details : {};
      const makeModel = [equipment.make, equipment.model].filter((value) => String(value || '').trim()).join(' ');
      const equipmentLabel = makeModel || equipment.name || equipment.equipmentName || log.truck_class || 'Equipment not specified';
      return <div key={log.id} className="bg-[#0b0f17] border border-slate-800 rounded-xl p-4 text-xs space-y-2">
      <div className="flex justify-between items-start"><div><span className="font-bold text-white text-sm">{log.customer_name || 'N/A'}</span><span className="block text-slate-500 text-[10px]">{log.customer_phone || 'No phone'}</span></div>{!isClientPortal && <span className="font-extrabold text-emerald-400 text-sm">${log.min_quote} – ${log.max_quote}</span>}</div>
      <div className="text-slate-400 space-y-0.5">{isClientQuote && <p><strong className="text-slate-300">Equipment:</strong> {equipmentLabel}{equipment.serialNumber ? ` · S/N ${equipment.serialNumber}` : ''}</p>}{!isClientQuote && <p><strong className="text-slate-300">Base:</strong> {log.base_yard_id || 'N/A'}</p>}<p><strong className="text-slate-300">Waypoints:</strong> {Array.isArray(log.all_waypoints) ? log.all_waypoints.join(' ➔ ') : 'N/A'}</p>{!isClientQuote && <p><strong className="text-slate-300">Hours:</strong> {Number(log.total_hours || 0).toFixed(2)} hrs</p>}{isClientQuote && <p><strong className="text-slate-300">BOL:</strong> {log.bol_name || 'Not attached'}</p>}</div>
      <div className={`grid grid-cols-2 ${isClientQuote ? 'sm:grid-cols-4' : ''} gap-1.5 pt-1`}>
        <button type="button" onClick={() => onSelectQuote?.(log)} className="rounded-lg border border-blue-500/30 px-2 py-2 font-semibold text-blue-300">Open</button>
        <button type="button" onClick={() => setShareId(shareId === log.id ? null : log.id)} className="rounded-lg border border-blue-500/30 px-2 py-2 font-semibold text-blue-300">Share</button>
        {isClientQuote && <button type="button" onClick={() => log.bol_path ? openBol(log) : attachBol(log)} disabled={busyId === log.id} className="rounded-lg border border-slate-700 px-2 py-2 font-semibold text-slate-300">{log.bol_path ? 'View BOL' : 'Attach BOL'}</button>}
        {isClientQuote && <button type="button" onClick={() => callEmail(log, 'action')} disabled={busyId === log.id} className="rounded-lg border border-amber-500/30 px-2 py-2 font-semibold text-amber-300">Send for Dispatch</button>}
      </div>
      {shareId === log.id && <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-[#080c14] p-2"><button type="button" onClick={() => savePdf(log)} className="rounded bg-slate-800 px-2 py-2 font-semibold text-white">Save as PDF</button><button type="button" onClick={() => { const email = window.prompt('Email this quote to:'); if (email) callEmail(log, 'share', email); }} className="rounded bg-blue-600 px-2 py-2 font-semibold text-white">Send as Email</button></div>}
    </div>;})}
  </div>;
}
