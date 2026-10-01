import { useEffect, useId, useRef } from 'react';

export default function Dialog({ open, title, children, confirmLabel = 'Confirm', destructive = false, onConfirm, onClose }) {
  const cancelRef = useRef(null);
  const panelRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const focusable = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-[#101621] p-5 shadow-2xl" onKeyDown={handleKeyDown}>
        <h2 id={titleId} className="text-lg font-bold text-white">{title}</h2>
        <div className="mt-3 text-sm text-slate-300">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onClose} className="rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-200">Cancel</button>
          <button type="button" onClick={onConfirm} className={`rounded-lg px-4 py-2 font-semibold text-white ${destructive ? 'bg-red-600' : 'bg-blue-600'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

