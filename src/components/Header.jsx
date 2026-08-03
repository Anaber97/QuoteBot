// src/components/Header.jsx
import React from 'react';

export default function Header({ activeTab, onSelectTab }) {
  return (
    <>
      <div className="flex flex-col items-center justify-center mb-6 px-2">
        <img
          src="/logo-trn.png"
          alt="TowCalc Pro Logo"
          className="w-[400px] max-w-full h-auto object-contain block drop-shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
        />
        <span className="mt-2 text-[10px] uppercase font-mono tracking-widest text-blue-400/90 bg-blue-500/10 border border-blue-500/20 px-3 py-0.5 rounded-full">
          Dispatch & Route Rate Engine
        </span>
      </div>

      <div className="flex bg-[#080c14] border border-slate-800/80 rounded-xl p-1 mb-6">
        <button
          type="button"
          onClick={() => onSelectTab('calculator')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
            activeTab === 'calculator'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Calculator
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('log')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
            activeTab === 'log'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Quote Log
        </button>
      </div>
    </>
  );
}