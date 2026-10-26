// src/components/Header.jsx
import React, { useEffect, useState } from 'react';
import { LogOut, Calculator, Moon, Sun } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Header({ session, activeTab, setActiveTab, profile, onSignOut, theme = 'dark', onToggleTheme }) {
  const [imgError, setImgError] = useState(false);
  const logoSrc = theme === 'dark' ? '/towcalc_fulllogo_light.svg' : '/towcalc_fulllogo_dark.svg';
  const rawRole = profile?.role || '';
  const role = rawRole.toLowerCase().trim();

  const isManager = role === 'manager';

  const roleBadgeStyle = 'bg-slate-800 text-slate-300 border-transparent';

  const handleSignOut = async () => {
    if (typeof onSignOut === 'function') {
      await onSignOut();
      return;
    }

    await supabase.auth.signOut();
  };

  useEffect(() => {
    setImgError(false);
  }, [logoSrc]);

  return (
    <div className="app-header border-b border-slate-800/80 bg-panel sticky top-0 z-50 px-3 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-start gap-3 lg:gap-6">
        
        {/* Logo & Title */}
        <div className="brand-lockup flex items-center justify-center lg:justify-start gap-3 sm:gap-5">
          {!imgError ? (
            <span className="inline-flex px-2 py-1">
              <img
                src={logoSrc}
                alt="TowCalc Pro Logo"
                onError={() => setImgError(true)}
                className="h-10 sm:h-12 w-auto object-contain py-0"
              />
            </span>
          ) : (
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center font-black text-accent-ink text-lg">
              <Calculator className="w-6 h-6 text-white" />
            </div>
          )}
          <h1 className="sr-only">TowCalc Pro</h1>
        </div>

        {/* Navigation Tabs */}
        {session && (
          <nav aria-label="Main navigation" className="flex bg-canvas border border-slate-800/80 rounded-xl p-1 w-full lg:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            aria-current={activeTab === 'calculator' ? 'page' : undefined}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Calculator
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            aria-current={activeTab === 'logs' ? 'page' : undefined}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-slate-800 text-white'
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
              aria-current={activeTab === 'settings' ? 'page' : undefined}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Settings
            </button>
          )}
          </nav>
        )}

        {/* Account controls must remain available even when profile loading fails. */}
        {session && (
          <div className="flex items-center gap-2 bg-canvas border border-slate-800 rounded-xl px-3 py-2 lg:ml-auto min-w-0">
            {profile && (
              <span className={`text-xs font-semibold capitalize px-2 py-0.5 rounded border ${roleBadgeStyle}`}>
                {rawRole || 'User'}
              </span>
            )}
            <span className="text-xs text-slate-300 font-medium truncate min-w-0 flex-1 lg:flex-none max-w-[190px] lg:max-w-[140px]">
              {profile?.email || session.user?.email || 'Signed in'}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 active:bg-red-500/15 transition cursor-pointer lg:min-h-8 lg:min-w-8"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5 lg:w-4 lg:h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-500/10 hover:text-blue-400 transition cursor-pointer lg:min-h-8 lg:min-w-8"
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
