import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { authenticatedFetch } from '../lib/api';
import Dialog from './Dialog';
import Toast from './Toast';

const allowedBol = (file) => file && (['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.name.toLowerCase().endsWith('.pdf'));
const PAGE_SIZE = 20;
const LIST_COLUMNS = 'id, quote_reference, company_id, client_id, quote_source, customer_name, customer_phone, all_waypoints, base_yard_id, truck_class, total_hours, total_miles, min_quote, max_quote, status, quote_details, notes, bol_path, bol_name, bol_type, created_at';
const quoteReference = (log) => log.quote_reference || `Q-${String(log.id || '').slice(0, 8).toUpperCase()}`;
const statusLabel = (status) => String(status || 'submitted').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const QUOTE_STATUSES = ['draft', 'submitted', 'approval_required', 'approved', 'dispatched', 'completed', 'cancelled'];

export default function QuoteLog({ onSelectQuote, profile }) {
  const [logs, setLogs] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null); const [shareId, setShareId] = useState(null);
  const [page, setPage] = useState(0); const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState(''); const [searchTerm, setSearchTerm] = useState('');
  const [notice, setNotice] = useState(null); const [dialog, setDialog] = useState(null); const [email, setEmail] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const fileRef = useRef(null); const pendingQuoteRef = useRef(null); const isClientPortal = profile?.role === 'client';

  const fetchLogs = useCallback(async (nextPage = 0) => {
    setLoading(true); setError(null);
    if (searchTerm) {
      try {
        const response = await authenticatedFetch(`/api/ops?check=quote-search&q=${encodeURIComponent(searchTerm)}&page=${nextPage}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Quote search failed.');
        setLogs(body.quotes || []); setHasMore(Boolean(body.hasMore)); setPage(nextPage);
      } catch (searchError) { setError(searchError.message); }
      setLoading(false); return;
    }
    let query = supabase.from('quote_logs').select(LIST_COLUMNS).order('created_at', { ascending: false }).range(nextPage * PAGE_SIZE, nextPage * PAGE_SIZE + PAGE_SIZE);
    if (isClientPortal) query = query.eq('quote_source', 'client_portal').eq('client_id', profile.client_id);
    const { data, error: loadError } = await query;
    if (loadError) setError(loadError.message); else { setLogs((data || []).slice(0, PAGE_SIZE)); setHasMore((data || []).length > PAGE_SIZE); setPage(nextPage); } setLoading(false);
  }, [isClientPortal, profile?.client_id, searchTerm]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const openQuote = async (log) => {
    setBusyId(log.id); setBusyAction('open'); setError(null);
    const { data, error: detailError } = await supabase.from('quote_logs').select('*').eq('id', log.id).single();
    setBusyId(null); setBusyAction('');
    if (detailError) return setError('Quote details could not be loaded. Please retry.');
    onSelectQuote?.(data);
  };

  const callEmail = async (log, action, recipient = null) => {
    setBusyId(log.id); setBusyAction(action === 'share' ? 'email' : 'dispatch');
    setNotice({ tone: 'progress', message: action === 'share' ? 'Sending quote email…' : 'Sending dispatch request…' });
    try {
      const response = await authenticatedFetch('/api/sendQuoteEmail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: log.id, action, recipient }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Email could not be sent.');
      setNotice({ message: action === 'share' ? 'Quote emailed.' : 'Quote sent for dispatch.' });
    } catch (emailError) { setNotice({ tone: 'error', message: emailError.message }); } finally { setBusyId(null); setBusyAction(''); }
  };
  const savePdf = async (log) => {
    setBusyId(log.id); setBusyAction('pdf'); setNotice({ tone: 'progress', message: 'Preparing quote PDF…' });
    try {
      const response = await authenticatedFetch(`/api/sendQuoteEmail?quoteId=${encodeURIComponent(log.id)}`);
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'PDF could not be generated.'); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `${quoteReference(log)}.pdf`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setNotice({ message: 'Branded quote PDF downloaded.' });
    } catch (pdfError) { setNotice({ tone: 'error', message: pdfError.message }); }
    finally { setBusyId(null); setBusyAction(''); }
  };
  const attachBol = (log) => { pendingQuoteRef.current = log; fileRef.current?.click(); };
  const handleBolFile = async (event) => {
    const file = event.target.files?.[0]; const log = pendingQuoteRef.current; event.target.value = ''; if (!log || !file) return;
    if (!allowedBol(file)) return setNotice({ tone: 'error', message: 'Choose a PDF, PNG, JPG, or WebP file.' }); setBusyId(log.id); setBusyAction('upload'); setNotice({ tone: 'progress', message: 'Uploading BOL…' });
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${profile.company_id}/${log.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('quote-bols').upload(path, file, { contentType: file.type, upsert: false }); if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('quote_logs').update({ bol_path: path, bol_name: file.name, bol_type: file.type }).eq('id', log.id); if (updateError) throw updateError;
      await fetchLogs();
      setNotice({ message: 'BOL attached.' });
    } catch (uploadError) { setNotice({ tone: 'error', message: uploadError.message }); }
    finally { setBusyId(null); setBusyAction(''); }
  };
  const openBol = async (log) => {
    setBusyId(log.id); setBusyAction('bol'); setNotice({ tone: 'progress', message: 'Opening BOL…' });
    const { data, error: signError } = await supabase.storage.from('quote-bols').createSignedUrl(log.bol_path, 60);
    if (signError) setNotice({ tone: 'error', message: signError.message });
    else { window.open(data.signedUrl, '_blank', 'noopener,noreferrer'); setNotice({ message: 'BOL opened.' }); }
    setBusyId(null); setBusyAction('');
  };
  const removeBol = async (log) => {
    if (!log.bol_path) return;
    setBusyId(log.id); setBusyAction('remove'); setNotice({ tone: 'progress', message: 'Removing BOL…' });
    try {
      const { error: removeError } = await supabase.storage.from('quote-bols').remove([log.bol_path]);
      if (removeError) throw removeError;
      const { error: updateError } = await supabase.from('quote_logs').update({ bol_path: null, bol_name: null, bol_type: null }).eq('id', log.id);
      if (updateError) throw updateError;
      await fetchLogs();
      setNotice({ message: 'BOL removed.' });
    } catch (removeError) { setNotice({ tone: 'error', message: removeError.message }); } finally { setBusyId(null); setBusyAction(''); }
  };
  const updateStatus = async (log, status) => {
    setBusyId(log.id); setBusyAction('status'); setNotice({ tone: 'progress', message: 'Updating quote status…' });
    try {
      const response = await authenticatedFetch('/api/updateQuoteStatus', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: log.id, status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Status could not be updated.');
      setLogs((current) => current.map((item) => item.id === log.id ? { ...item, status } : item));
      setNotice({ message: `Quote marked ${statusLabel(status)}.` });
    } catch (statusError) {
      setNotice({ tone: 'error', message: statusError.message });
    } finally { setBusyId(null); setBusyAction(''); }
  };

  const searchForm = <form onSubmit={(event) => { event.preventDefault(); const next = searchInput.trim(); setPage(0); if (next === searchTerm) fetchLogs(0); else setSearchTerm(next); }} className="flex flex-col gap-2 sm:flex-row">
    <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search ID, POC name/number, Make/Model, or equipment" className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-[#0b0f17] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
    <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500">Search</button>
    {(searchTerm || searchInput) && <button type="button" onClick={() => { setSearchInput(''); setSearchTerm(''); setPage(0); }} className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300">Clear</button>}
  </form>;

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm"><div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-500 rounded-full mb-2" /><p>Loading saved quotes...</p></div>;
  if (error) return <div className="p-4 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs font-medium">Failed to load quote log: {error}</div>;
  if (!logs.length) return <div className="space-y-3">{searchForm}<div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl"><p className="text-sm font-semibold text-slate-400 mb-1">{searchTerm ? 'No matching quotes' : 'No Quotes Logged Yet 📊'}</p><p className="text-xs">{searchTerm ? 'Try another ID, contact, or equipment search.' : 'Saved quotes will appear here.'}</p></div></div>;

  return <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">{searchForm}<input ref={fileRef} type="file" hidden accept="application/pdf,image/png,image/jpeg,image/webp" onChange={handleBolFile} />
    {logs.map((log) => {
      const isClientQuote = log.quote_source === 'client_portal';
      const equipment = log.quote_details && typeof log.quote_details === 'object' ? log.quote_details : {};
      const equipmentLabel = [equipment.make, equipment.model].filter(Boolean).join(' ') || equipment.name || equipment.equipmentName || log.truck_class || 'Equipment details available when opened';
      return <div key={log.id} className="bg-[#0b0f17] border border-slate-800 rounded-xl p-4 text-xs space-y-2">
      <div className="flex justify-between items-start gap-3"><div><span className="font-bold text-white text-sm">{log.customer_name || 'N/A'}</span><span className="block text-slate-500 text-[10px]">{quoteReference(log)} · {new Date(log.created_at).toLocaleString()}</span>{isClientQuote && <span className="mt-1 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-300">{statusLabel(log.status)}</span>}</div>{!isClientPortal && <span className="font-extrabold text-emerald-400 text-sm">${log.min_quote}</span>}</div>
      <div className="text-slate-400 space-y-0.5">{isClientQuote && <p><strong className="text-slate-300">Equipment:</strong> {equipmentLabel}</p>}{!isClientQuote && <p><strong className="text-slate-300">Base:</strong> {log.base_yard_id || 'N/A'}</p>}<p><strong className="text-slate-300">Waypoints:</strong> {Array.isArray(log.all_waypoints) ? log.all_waypoints.join(' ➔ ') : 'N/A'}</p>{!isClientQuote && <p><strong className="text-slate-300">Hours:</strong> {Number(log.total_hours || 0).toFixed(2)} hrs</p>}{isClientQuote && <p><strong className="text-slate-300">BOL:</strong> {log.bol_name || 'Not attached'}</p>}</div>
      {!isClientPortal && isClientQuote && <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status<select value={log.status || 'submitted'} disabled={busyId === log.id} onChange={(event) => updateStatus(log, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs normal-case text-white">{QUOTE_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>}
      <div className={`grid grid-cols-2 ${isClientQuote ? (log.bol_path ? 'sm:grid-cols-5' : 'sm:grid-cols-4') : ''} gap-1.5 pt-1`}>
        <button type="button" onClick={() => openQuote(log)} disabled={busyId === log.id} className="rounded-lg border border-blue-500/30 px-2 py-2 font-semibold text-blue-300 transition hover:bg-blue-500/10 active:scale-95 disabled:opacity-60">{busyId === log.id && busyAction === 'open' ? 'Opening…' : 'Open'}</button>
        <button type="button" onClick={() => setShareId(shareId === log.id ? null : log.id)} className="rounded-lg border border-blue-500/30 px-2 py-2 font-semibold text-blue-300 transition hover:bg-blue-500/10 active:scale-95">{shareId === log.id ? 'Close Share' : 'Share'}</button>
        {isClientQuote && <button type="button" onClick={() => log.bol_path ? openBol(log) : attachBol(log)} disabled={busyId === log.id} className="rounded-lg border border-slate-700 px-2 py-2 font-semibold text-slate-300 transition hover:bg-slate-800 active:scale-95 disabled:opacity-60">{busyId === log.id && ['bol', 'upload'].includes(busyAction) ? (busyAction === 'upload' ? 'Uploading…' : 'Opening…') : log.bol_path ? 'View BOL' : 'Attach BOL'}</button>}
        {isClientQuote && log.bol_path && <button type="button" onClick={() => setDialog({ type: 'remove', log })} disabled={busyId === log.id} className="rounded-lg border border-red-500/30 px-2 py-2 font-semibold text-red-300 transition hover:bg-red-500/10 active:scale-95 disabled:opacity-60">{busyId === log.id && busyAction === 'remove' ? 'Removing…' : 'Remove BOL'}</button>}
        {isClientQuote && <button type="button" onClick={() => callEmail(log, 'action')} disabled={busyId === log.id} className="rounded-lg border border-amber-500/30 px-2 py-2 font-semibold text-amber-300 transition hover:bg-amber-500/10 active:scale-95 disabled:opacity-60">{busyId === log.id && busyAction === 'dispatch' ? 'Sending…' : 'Send for Dispatch'}</button>}
      </div>
      {shareId === log.id && <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-[#080c14] p-2"><button type="button" disabled={busyId === log.id} onClick={() => savePdf(log)} className="rounded bg-slate-800 px-2 py-2 font-semibold text-white transition hover:bg-slate-700 active:scale-95 disabled:opacity-60">{busyId === log.id && busyAction === 'pdf' ? 'Preparing…' : 'Save as PDF'}</button><button type="button" onClick={() => { setEmail(''); setDialog({ type: 'email', log }); }} className="rounded bg-blue-600 px-2 py-2 font-semibold text-white transition hover:bg-blue-500 active:scale-95">Send as Email</button></div>}
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
