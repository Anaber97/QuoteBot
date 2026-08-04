import React from 'react';
import { LogOut } from 'lucide-react';

export default function Header({ activeTab, onSelectTab, profile, onSignOut }) {
  const role = profile?.role;

  const roleBadgeStyle = {
    manager: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    dispatch: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    client: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  }[role] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';

  return (
    <>
      <div className="flex flex-col items-center justify-center mb-6 px-2 relative">
        {/* User Info & Sign Out (Top Right) - Only when logged in */}
        {profile && (
          <div className="sm:absolute sm:right-0 sm:top-0 flex items-center gap-2 mb-4 sm:mb-0 bg-[#080c14] border border-slate-800 rounded-xl px-3 py-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${roleBadgeStyle}`}>
              {role}
            </span>
            <span className="text-xs text-slate-300 font-medium hidden md:inline">
              {profile.email}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign Out"
              className="text-slate-400 hover:text-red-400 p-1 cursor-pointer transition ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <img
          src="/logo-trn.png"
          alt="TowCalc Pro Logo"
          className="w-[400px] max-w-full h-auto object-contain block drop-shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
        />
        <span className="mt-2 text-[10px] uppercase font-mono tracking-widest text-blue-400/90 bg-blue-500/10 border border-blue-500/20 px-3 py-0.5 rounded-full">
          Dispatch & Route Rate Engine
        </span>
      </div>

      {/* Tabs - ONLY show if logged in AND user is not a Client */}
      {profile && role !== 'client' && (
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

          {role === 'manager' && (
            <button
              type="button"
              onClick={() => onSelectTab('settings')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Settings
            </button>
          )}
        </div>
      )}
    </>
  );
}