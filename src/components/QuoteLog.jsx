import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { authenticatedFetch } from '../lib/api';
import Dialog from './Dialog';
import Toast from './Toast';

const allowedBol = (file) => file && (['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.name.toLowerCase().endsWith('.pdf'));
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const quoteHtml = (log) => `<!doctype html><html><head><title>Quote ${escapeHtml(log.id)}</title><style>body{font-family:Arial,sans-serif;color:#172033;max-width:760px;margin:40px auto}h1{margin-bottom:4px}.price{font-size:28px;font-weight:700;color:#047857}.row{padding:10px 0;border-bottom:1px solid #ddd}small{color:#667085}@media print{button{display:none}}</style></head><body><h1>Transport Quote</h1><small>${escapeHtml(new Date(log.created_at).toLocaleString())}</small><p class="price">$${escapeHtml(log.min_quote)} – $${escapeHtml(log.max_quote)}</p><div class="row"><b>Customer:</b> ${escapeHtml(log.customer_name || 'N/A')}</div><div class="row"><b>Phone:</b> ${escapeHtml(log.customer_phone || 'N/A')}</div><div class="row"><b>Route:</b> ${escapeHtml((log.all_waypoints || []).join(' → '))}</div><div class="row"><b>Miles:</b> ${Number(log.total_miles || 0).toFixed(1)}</div><div class="row"><b>Hours:</b> ${Number(log.total_hours || 0).toFixed(2)}</div><button onclick="window.print()">Print / Save as PDF</button></body></html>`;
const PAGE_SIZE = 20;
const LIST_COLUMNS = 'id, company_id, client_id, quote_source, customer_name, customer_phone, all_waypoints, base_yard_id, truck_class, total_hours, total_miles, min_quote, max_quote, status, bol_path, bol_name, bol_type, created_at';
const quoteReference = (log) => log.quote_reference || `Q-${String(log.id || '').slice(0, 8).toUpperCase()}`;
const statusLabel = (status) => String(status || 'submitted').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function QuoteLog({ onSelectQuote, profile }) {
  const [logs, setLogs] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null); const [shareId, setShareId] = useState(null);
  const [page, setPage] = useState(0); const [hasMore, setHasMore] = useState(false);
  const [notice, setNotice] = useState(null); const [dialog, setDialog] = useState(null); const [email, setEmail] = useState('');
  const fileRef = useRef(null); const pendingQuoteRef = useRef(null); const isClientPortal = profile?.role === 'client';

  const fetchLogs = useCallback(async (nextPage = 0) => {
    setLoading(true); setError(null);
    let query = supabase.from('quote_logs').select(LIST_COLUMNS).order('created_at', { ascending: false }).range(nextPage * PAGE_SIZE, nextPage * PAGE_SIZE + PAGE_SIZE);
    if (isClientPortal) query = query.eq('quote_source', 'client_portal').eq('client_id', profile.client_id);
    const { data, error: loadError } = await query;
    if (loadError) setError(loadError.message); else { setLogs((data || []).slice(0, PAGE_SIZE)); setHasMore((data || []).length > PAGE_SIZE); setPage(nextPage); } setLoading(false);
  }, [isClientPortal, profile?.client_id]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const openQuote = async (log) => {
    setBusyId(log.id); setError(null);
    const { data, error: detailError } = await supabase.from('quote_logs').select('*').eq('id', log.id).single();
    setBusyId(null);
    if (detailError) return setError('Quote details could not be loaded. Please retry.');
    onSelectQuote?.(data);
  };

  const callEmail = async (log, action, recipient = null) => {
    setBusyId(log.id);
    try {
      const response = await authenticatedFetch('/api/sendQuoteEmail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: log.id, action, recipient }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Email could not be sent.');
      setNotice({ message: action === 'share' ? 'Quote emailed.' : 'Quote sent for dispatch.' });
    } catch (emailError) { setNotice({ tone: 'error', message: emailError.message }); } finally { setBusyId(null); }
  };
  const savePdf = (log) => { const win = window.open('', '_blank'); if (!win) return setNotice({ tone: 'error', message: 'Please allow pop-ups to save the quote as a PDF.' }); win.document.write(quoteHtml(log)); win.document.close(); win.focus(); setTimeout(() => win.print(), 150); };
  const attachBol = (log) => { pendingQuoteRef.current = log; fileRef.current?.click(); };
  const handleBolFile = async (event) => {
    const file = event.target.files?.[0]; const log = pendingQuoteRef.current; event.target.value = ''; if (!log || !file) return;
    if (!allowedBol(file)) return setNotice({ tone: 'error', message: 'Choose a PDF, PNG, JPG, or WebP file.' }); setBusyId(log.id);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${profile.company_id}/${log.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('quote-bols').upload(path, file, { contentType: file.type, upsert: false }); if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('quote_logs').update({ bol_path: path, bol_name: file.name, bol_type: file.type }).eq('id', log.id); if (updateError) throw updateError;
      await fetchLogs();
      setNotice({ message: 'BOL attached.' });
    } catch (uploadError) { setNotice({ tone: 'error', message: uploadError.message }); setBusyId(null); }
  };
  const openBol = async (log) => { const { data, error: signError } = await supabase.storage.from('quote-bols').createSignedUrl(log.bol_path, 60); if (signError) return setNotice({ tone: 'error', message: signError.message }); window.open(data.signedUrl, '_blank', 'noopener,noreferrer'); };
  const removeBol = async (log) => {
    if (!log.bol_path) return;
    setBusyId(log.id);
    try {
      const { error: removeError } = await supabase.storage.from('quote-bols').remove([log.bol_path]);
      if (removeError) throw removeError;
      const { error: updateError } = await supabase.from('quote_logs').update({ bol_path: null, bol_name: null, bol_type: null }).eq('id', log.id);
      if (updateError) throw updateError;
      await fetchLogs();
      setNotice({ message: 'BOL removed.' });
    } catch (removeError) { setNotice({ tone: 'error', message: removeError.message }); } finally { setBusyId(null); }
  };

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm"><div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-500 rounded-full mb-2" /><p>Loading saved quotes...</p></div>;
  if (error) return <div className="p-4 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs font-medium">Failed to load quote log: {error}</div>;
  if (!logs.length) return <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl"><p className="text-sm font-semibold text-slate-400 mb-1">No Quotes Logged Yet 📊</p><p className="text-xs">Saved quotes will appear here.</p></div>;

  return <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1"><input ref={fileRef} type="file" hidden accept="application/pdf,image/png,image/jpeg,image/webp" onChange={handleBolFile} />
    {logs.map((log) => {
      const isClientQuote = log.quote_source === 'client_portal';
      const equipmentLabel = log.truck_class || 'Equipment details available when opened';
      return <div key={log.id} className="bg-[#0b0f17] border border-slate-800 rounded-xl p-4 text-xs space-y-2">
      <div className="flex justify-between items-start gap-3"><div><span className="font-bold text-white text-sm">{log.customer_name || 'N/A'}</span><span className="block text-slate-500 text-[10px]">{quoteReference(log)} · {new Date(log.created_at).toLocaleString()}</span><span className="mt-1 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-300">{statusLabel(log.status)}</span></div>{!isClientPortal && <span className="font-extrabold text-emerald-400 text-sm">${log.min_quote} – ${log.max_quote}</span>}</div>
      <div className="text-slate-400 space-y-0.5">{isClientQuote && <p><strong className="text-slate-300">Equipment:</strong> {equipmentLabel}{equipment.serialNumber ? ` · S/N ${equipment.serialNumber}` : ''}</p>}{!isClientQuote && <p><strong className="text-slate-300">Base:</strong> {log.base_yard_id || 'N/A'}</p>}<p><strong className="text-slate-300">Waypoints:</strong> {Array.isArray(log.all_waypoints) ? log.all_waypoints.join(' ➔ ') : 'N/A'}</p>{!isClientQuote && <p><strong className="text-slate-300">Hours:</strong> {Number(log.total_hours || 0).toFixed(2)} hrs</p>}{isClientQuote && <p><strong className="text-slate-300">BOL:</strong> {log.bol_name || 'Not attached'}</p>}</div>
      <div className={`grid grid-cols-2 ${isClientQuote ? (log.bol_path ? 'sm:grid-cols-5' : 'sm:grid-cols-4') : ''} gap-1.5 pt-1`}>
        <button type="button" onClick={() => openQuote(log)} disabled={busyId === log.id} className="rounded-lg border border-blue-500/30 px-2 py-2 font-semibold text-blue-300">{busyId === log.id ? 'Opening…' : 'Open'}</button>
        <button type="button" onClick={() => setShareId(shareId === log.id ? null : log.id)} className="rounded-lg border border-blue-500/30 px-2 py-2 font-semibold text-blue-300">Share</button>
        {isClientQuote && <button type="button" onClick={() => log.bol_path ? openBol(log) : attachBol(log)} disabled={busyId === log.id} className="rounded-lg border border-slate-700 px-2 py-2 font-semibold text-slate-300">{log.bol_path ? 'View BOL' : 'Attach BOL'}</button>}
        {isClientQuote && log.bol_path && <button type="button" onClick={() => setDialog({ type: 'remove', log })} disabled={busyId === log.id} className="rounded-lg border border-red-500/30 px-2 py-2 font-semibold text-red-300">Remove BOL</button>}
        {isClientQuote && <button type="button" onClick={() => callEmail(log, 'action')} disabled={busyId === log.id} className="rounded-lg border border-amber-500/30 px-2 py-2 font-semibold text-amber-300">Send for Dispatch</button>}
      </div>
      {shareId === log.id && <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-[#080c14] p-2"><button type="button" onClick={() => savePdf(log)} className="rounded bg-slate-800 px-2 py-2 font-semibold text-white">Save as PDF</button><button type="button" onClick={() => { setEmail(''); setDialog({ type: 'email', log }); }} className="rounded bg-blue-600 px-2 py-2 font-semibold text-white">Send as Email</button></div>}
    </div>;})}
    <div className="flex items-center justify-between pt-2" aria-label="Quote history pagination">
      <button type="button" disabled={page === 0 || loading} onClick={() => fetchLogs(page - 1)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button>
      <span className="text-xs text-slate-500">Page {page + 1}</span>
      <button type="button" disabled={!hasMore || loading} onClick={() => fetchLogs(page + 1)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button>
    </div>
    <Dialog open={Boolean(dialog)} title={dialog?.type === 'email' ? 'Email this quote' : 'Remove attachment?'} confirmLabel={dialog?.type === 'email' ? 'Send email' : 'Remove BOL'} destructive={dialog?.type === 'remove'} onClose={() => setDialog(null)} onConfirm={() => { const current = dialog; setDialog(null); if (current?.type === 'email' && email.trim()) callEmail(current.log, 'share', email.trim()); if (current?.type === 'remove') removeBol(current.log); }}>
      {dialog?.type === 'email' ? <label className="block">Recipient email<input autoFocus type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="name@company.com" /></label> : <p>Remove <strong>{dialog?.log?.bol_name || 'this BOL'}</strong> from the quote? This cannot be undone.</p>}
    </Dialog>
    <Toast notice={notice} onDismiss={() => setNotice(null)} />
  </div>;
}
