import React from 'react';
import { legalLinks } from '../legal/legalContent';

export default function PolicyAcknowledgment({ checked, onChange, id = 'policy-acknowledgment' }) {
  return <div className="rounded-xl border border-slate-700 bg-[#080c14] p-3">
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-300">
      <input id={id} name="policyAcknowledgment" type="checkbox" required checked={checked} onChange={onChange} className="mt-1 h-4 w-4 shrink-0 accent-blue-600" />
      <span>I agree to the <a href={legalLinks.terms} target="_blank" rel="noreferrer" className="font-semibold text-blue-400 underline">Terms of Use</a> and acknowledge the <a href={legalLinks.privacy} target="_blank" rel="noreferrer" className="font-semibold text-blue-400 underline">Privacy Policy</a>.</span>
    </label>
  </div>;
}
