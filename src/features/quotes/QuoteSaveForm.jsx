import React, { useState, useRef } from 'react';

/** Contact details, optional BOL selection, and quote submission controls. */
export default function QuoteSaveForm({ state, dispatch, isDispatcherView, onLogQuote, onSaveForLater, onAcceptQuote }) {
  const { quoteData, customerName, customerPhone, isSaving, saveStatus } = state;
  const [showAttachmentPrompt, setShowAttachmentPrompt] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef(null);
  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedAttachment(null);
      return;
    }

    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
      setAttachmentError('Please choose a PDF or image file.');
      setSelectedAttachment(null);
      return;
    }

    setSelectedAttachment(file);
    setAttachmentError('');
  };

  const handleAcceptQuote = () => {
    if (!showAttachmentPrompt) {
      setShowAttachmentPrompt(true);
      return;
    }

    onAcceptQuote?.({ attachmentFile: selectedAttachment || null });
    setShowAttachmentPrompt(false);
  };

  const handleSkipAttachment = () => {
    setShowAttachmentPrompt(false);
    setSelectedAttachment(null);
    setAttachmentError('');
    onAcceptQuote?.({ attachmentFile: null });
  };

  const handleLogQuote = () => {
    if (!showAttachmentPrompt) {
      setShowAttachmentPrompt(true);
      return;
    }
    onLogQuote?.({ attachmentFile: selectedAttachment || null });
    setShowAttachmentPrompt(false);
  };

  return (
    <div className="space-y-3 pt-2 border-t border-slate-800/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Contact Name"
            value={customerName}
            onChange={(e) =>
              dispatch({
                type: 'SET_CUSTOMER_INFO',
                payload: { field: 'customerName', value: e.target.value },
              })
            }
            className="bg-[#080c14] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Phone Number"
            value={customerPhone}
            onChange={(e) =>
              dispatch({
                type: 'SET_CUSTOMER_INFO',
                payload: { field: 'customerPhone', value: e.target.value },
              })
            }
            className="bg-[#080c14] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {isDispatcherView && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input type="text" placeholder="Equipment Make" value={state?.quoteMake ?? ''} onChange={(e) => dispatch?.({ type: 'SET_QUOTE_META_FIELDS', payload: { quoteMake: e.target.value } })} className="bg-[#080c14] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" placeholder="Equipment Model" value={state?.quoteModel ?? ''} onChange={(e) => dispatch?.({ type: 'SET_QUOTE_META_FIELDS', payload: { quoteModel: e.target.value } })} className="bg-[#080c14] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>}
        <textarea placeholder="Quote notes" value={state?.quoteNotes ?? ''} onChange={(e) => dispatch?.({ type: 'SET_QUOTE_META_FIELDS', payload: { quoteNotes: e.target.value } })} rows={3} className="w-full resize-y bg-[#080c14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />

        {quoteData?.approvalRequired && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
            This quote exceeds the approval threshold and has been flagged for manager review.
          </div>
        )}

        {onSaveForLater || onAcceptQuote ? (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {onSaveForLater && (
                <button
                  type="button"
                  onClick={onSaveForLater}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save for later'}
                </button>
              )}
              {onAcceptQuote && (
                <button
                  type="button"
                  onClick={handleAcceptQuote}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-50"
                >
                  {isSaving ? 'Submitting...' : 'Request Dispatch and Attach BOL'}
                </button>
              )}
            </div>
            {showAttachmentPrompt && (
              <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3 space-y-2 text-left">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Attach BOL (PDF or image, optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleAttachmentChange}
                  className="block w-full text-[11px] text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-300"
                />
                {attachmentError && <p className="text-[10px] text-red-400">{attachmentError}</p>}
                {selectedAttachment && <p className="text-[10px] text-emerald-400">Selected: {selectedAttachment.name}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptQuote}
                    className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipAttachment}
                    className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-300"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <button type="button" onClick={handleLogQuote} disabled={isSaving} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:bg-slate-800 cursor-pointer shadow-md">
              {isSaving ? 'Saving Quote...' : 'Save & Log Quote'}
            </button>
            {showAttachmentPrompt && (
              <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3 space-y-2 text-left">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Attach BOL (PDF or image, optional)</label>
                <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={handleAttachmentChange} className="block w-full text-[11px] text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-300" />
                {attachmentError && <p className="text-[10px] text-red-400">{attachmentError}</p>}
                {selectedAttachment && <p className="text-[10px] text-emerald-400">Selected: {selectedAttachment.name}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={handleLogQuote} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Log quote</button>
                  <button type="button" onClick={() => { setShowAttachmentPrompt(false); setSelectedAttachment(null); setAttachmentError(''); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {saveStatus && (
          <p
            className={`text-xs text-center font-semibold ${
              saveStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {saveStatus.message}
          </p>
        )}
      </div>
  );
}
