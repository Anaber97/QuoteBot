import { useRef, useState } from 'react';

export default function QuoteReport({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sending = useRef(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim() || sending.current) return;
    sending.current = true; setBusy(true); setMessage('');
    try {
      await onSubmit(reason.trim());
      setOpen(false); setReason(''); setMessage('Report sent to your transport company.');
    } catch (error) { setMessage(error.message || 'Could not send report. Please retry.'); }
    finally { sending.current = false; setBusy(false); }
  };
  return <div className="mt-3 text-right">
    <button type="button" onClick={() => { setOpen(true); setMessage(''); }} className="text-xs text-slate-400 underline hover:text-white">Report this quote</button>
    {message && !open && <p role="status" className="mt-2 text-xs text-slate-300">{message}</p>}
    {open && <section role="dialog" aria-label="Report this quote" className="fixed bottom-4 right-4 z-[70] w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-600 bg-[#101621] p-4 text-left shadow-2xl" onKeyDown={(event) => { if (event.key === 'Escape' && !busy) setOpen(false); }}>
      <form onSubmit={submit}>
        <label htmlFor="quote-report-reason" className="text-sm font-semibold text-white">What’s wrong with this quote?</label>
        <textarea id="quote-report-reason" autoFocus required maxLength={2000} rows={4} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-600 bg-[#080c14] p-2 text-sm text-white" />
        <p className="text-xs text-slate-400">Sends your reason and quote details to your transport company. The quote is saved so they can open it.</p>
        {message && <p role="alert" className="mt-2 text-xs text-red-300">{message}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-slate-300">Cancel</button>
          <button type="submit" disabled={busy || !reason.trim()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Submit report'}</button>
        </div>
      </form>
    </section>}
  </div>;
}
