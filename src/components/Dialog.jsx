import { useEffect, useRef } from 'react';

export default function Dialog({ open, title, children, confirmLabel = 'Confirm', destructive = false, onConfirm, onClose }) {
  const cancelRef = useRef(null);
  useEffect(() => { if (open) cancelRef.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#101621] p-5 shadow-2xl" onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
        <h2 id="dialog-title" className="text-lg font-bold text-white">{title}</h2>
        <div className="mt-3 text-sm text-slate-300">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onClose} className="rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-200">Cancel</button>
          <button type="button" onClick={onConfirm} className={`rounded-lg px-4 py-2 font-semibold text-white ${destructive ? 'bg-red-600' : 'bg-blue-600'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

