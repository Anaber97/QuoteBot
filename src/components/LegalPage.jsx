import React from 'react';
import Footer from './Footer';
import { policies } from '../legal/legalContent';

export default function LegalPage({ type }) {
  const policy = policies[type];
  return <div className="flex min-h-screen flex-col bg-[#080c14] text-slate-100">
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
      <a href="/" className="text-sm font-semibold text-blue-400 hover:text-blue-300">← Back to TowCalc</a>
      <article className="mt-5 rounded-2xl border border-slate-800 bg-[#121824] p-5 shadow-2xl sm:p-8">
        <h1 className="text-3xl font-black text-white">{policy.title}</h1>
        <p className="mt-2 text-xs text-slate-500">Policy version: {policy.version}</p>
        <p className="mt-5 text-sm leading-6 text-slate-300">{policy.intro}</p>
        <div className="mt-8 space-y-7">{policy.sections.map(([heading, body]) => <section key={heading}>
          <h2 className="text-lg font-bold text-white">{heading}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
        </section>)}</div>
      </article>
    </main>
    <Footer />
  </div>;
}
