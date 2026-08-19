// src/components/Header.jsx
import React, { useState } from 'react';
import { LogOut, Calculator, Moon, Sun } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Header({ activeTab, setActiveTab, profile, onSignOut, theme = 'dark', onToggleTheme }) {
  const [imgError, setImgError] = useState(false);
  const rawRole = profile?.role || '';
  const role = rawRole.toLowerCase().trim();

  // Debug log to browser console

  const isManager = role === 'manager';

  const roleBadgeStyle =
    {
      manager: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      dispatch: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      client: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    }[role] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';

  const handleSignOut = async () => {
    if (typeof onSignOut === 'function') {
      await onSignOut();
      return;
    }

    await supabase.auth.signOut();
  };

  return (
    <div className="app-header border-b border-slate-800/80 bg-[#121824]/60 backdrop-blur-md sticky top-0 z-50 px-3 sm:px-6 py-3 sm:py-5">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-start gap-3 lg:gap-6">
        
        {/* Logo & Title */}
        <div className="brand-lockup flex items-center justify-center lg:justify-start gap-3 sm:gap-5">
          {!imgError ? (
            <span className="brand-logo-surface inline-flex rounded-xl px-2 py-1">
              <img
                src="/logo-trn.png"
                alt="TowCalc Pro Logo"
                onError={() => setImgError(true)}
                className="h-12 sm:h-16 w-auto object-contain py-0"
              />
            </span>
          ) : (
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/20">
              <Calculator className="w-6 h-6 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none flex items-center gap-2">
                <span className="text-blue-500 font-semibold text-xs">Route-Based Towing Calculator</span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Instant. Accurate. Dispatched.</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-[#080c14] border border-slate-800/80 rounded-xl p-1 w-full lg:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Calculator
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Quote Log
          </button>

          {/* Render Settings for Managers */}
          {isManager && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Settings
            </button>
          )}
        </div>

        {/* User Badge & Logout */}
        {profile && (
          <div className="flex items-center gap-2 bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 lg:ml-auto min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${roleBadgeStyle}`}>
              {rawRole || 'User'}
            </span>
            <span className="text-xs text-slate-300 font-medium truncate max-w-[140px]">
              {profile.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-slate-500 hover:text-red-400 p-1 transition cursor-pointer ml-1"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="text-slate-500 hover:text-blue-400 p-1 transition cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
