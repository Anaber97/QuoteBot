// src/components/LoginCard.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, LogIn, CheckCircle2, UserPlus, HelpCircle } from 'lucide-react';

export default function LoginCard() {
  const [mode, setMode] = useState('login'); // 'login' | 'request'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // 1. Added Password state
  
  // Account Request Form State
  const [requestName, setRequestName] = useState('');
  const [requestCompanyName, setRequestCompanyName] = useState('');
  const [requestPhone, setRequestPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);

  try {
    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail || !password) {
      throw new Error('Please enter both your email and password.');
    }

    // Authenticate FIRST.
    const { data: authData, error: authErr } =
      await supabase.auth.signInWithPassword({
        email: cleanedEmail,
        password,
      });

    if (authErr) throw authErr;

    // Now that we're authenticated, RLS allows us to read
    // the user's own profile.
    const { data: profileMatch, error: profileErr } =
      await supabase
        .from('profiles')
        .select('id, email, company_id, role, full_name')
        .eq('id', authData.user.id)
        .maybeSingle();

    if (profileErr) {
      await supabase.auth.signOut();
      throw new Error('Unable to load your company profile.');
    }

    if (!profileMatch?.company_id) {
      await supabase.auth.signOut();
      throw new Error(
        'Access denied. Your account is not associated with a company workspace.'
      );
    }

    // Supabase has the authenticated session.
    // App.jsx will pick it up through the auth state listener.
  } catch (err) {
    setError(err.message || 'Failed to sign in.');
  } finally {
    setLoading(false);
  }
};

  const handlePasswordReset = async () => {
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      setError('Enter your email address first, then choose password reset.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
        redirectTo: `${window.location.origin}/`,
      });
      if (resetError) throw resetError;
      setSuccessMessage('If that email has an account, we sent a password-reset link.');
    } catch (err) {
      setError(err.message || 'Unable to send the password reset email.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Paid Account Request to Queue
  const handleRequestAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: reqErr } = await supabase.from('account_requests').insert([
        {
          full_name: requestName.trim(),
          company_name: requestCompanyName.trim(),
          email: email.trim().toLowerCase(),
          phone: requestPhone.trim(),
          status: 'pending',
        },
      ]);

      if (reqErr) throw reqErr;
      setSuccessMessage('Access request received! Our team will review and email your company credentials shortly.');
    } catch (err) {
      setError(err.message || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#121824] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-400">
          {mode === 'request' ? <UserPlus className="w-6 h-6" /> : <LogIn className="w-6 h-6" />}
        </div>
        <h2 className="text-xl font-bold text-white">
          {mode === 'request' ? 'Request Access' : 'Sign In'}
        </h2>
        <p className="text-xs text-slate-400">
          {mode === 'request'
            ? 'Fill out the form below to request a managed company workspace.'
            : 'Enter your credentials to access your company dashboard.'}
        </p>
      </div>

      {successMessage ? (
        <div className="p-6 bg-emerald-950/30 border border-emerald-800/50 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-sm font-bold text-emerald-300">Success!</h3>
          <p className="text-xs text-slate-300">{successMessage}</p>
          <button
            type="button"
            onClick={() => {
              setSuccessMessage('');
              setMode('login');
            }}
            className="text-[11px] text-slate-400 hover:text-white underline pt-2 cursor-pointer block mx-auto"
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-xs text-center font-medium">
              {error}
            </div>
          )}

          {/* VIEW 1: Existing User Login */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="dispatcher@towco.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#080c14] border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 3. Password Input Field */}
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#080c14] border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-bold text-xs text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : <>Sign In <LogIn className="w-4 h-4" /></>}
              </button>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={loading}
                className="w-full text-center text-[11px] text-blue-400 transition hover:text-blue-300 disabled:opacity-60"
              >
                Forgot your password?
              </button>
            </form>
          )}

          {/* VIEW 2: Account Request Queue */}
          {mode === 'request' && (
            <form onSubmit={handleRequestAccount} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Your Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Dave Smith"
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Company / Fleet Name</label>
                <input
                  type="text"
                  required
                  placeholder="Apex Towing & Recovery"
                  value={requestCompanyName}
                  onChange={(e) => setRequestCompanyName(e.target.value)}
                  className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    placeholder="dave@apextow.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="555-0199"
                    value={requestPhone}
                    onChange={(e) => setRequestPhone(e.target.value)}
                    className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-bold text-xs text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 mt-2"
              >
                {loading ? 'Submitting...' : 'Submit Access Request'}
              </button>
            </form>
          )}

          {/* Mode Switcher Links */}
          <div className="text-center pt-3 border-t border-slate-800/80 space-y-2">
            {mode !== 'login' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                className="text-xs text-blue-400 hover:underline block mx-auto cursor-pointer"
              >
                Back to Sign In
              </button>
            )}
            {mode !== 'request' && (
              <button
                type="button"
                onClick={() => { setMode('request'); setError(null); }}
                className="text-xs text-slate-400 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Need sales assistance? Request access
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
