export default function Toast({ notice, onDismiss }) {
  if (!notice) return null;
  const tone = notice.tone === 'error'
    ? 'border-red-500/50 bg-red-950 text-red-100'
    : notice.tone === 'progress'
      ? 'border-blue-500/50 bg-blue-950 text-blue-100'
      : 'border-emerald-500/50 bg-emerald-950 text-emerald-100';
  return (
    <div className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border px-4 py-3 shadow-2xl ${tone}`} role={notice.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
      <div className="flex items-start gap-3">
        {notice.tone === 'progress' && <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-transparent" aria-hidden="true" />}
        <p className="text-sm font-medium">{notice.message}</p>
        <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="text-lg leading-none opacity-70 hover:opacity-100">×</button>
      </div>
    </div>
  );
}

