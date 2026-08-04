// src/components/LoginCard.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Building2, Send, CheckCircle2, UserPlus, HelpCircle } from 'lucide-react';

export default function LoginCard() {
  const [isRequestingAccount, setIsRequestingAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  
  // Account Request Form State
  const [requestName, setRequestName] = useState('');
  const [requestCompanyName, setRequestCompanyName] = useState('');
  const [requestPhone, setRequestPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Send Magic Link for Existing Accounts
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!companyCode.trim()) {
        throw new Error('Please enter your 6-digit Company ID.');
      }

      // 1. Verify Company Code exists
      const { data: existingComp, error: findErr } = await supabase
        .from('companies')
        .select('id')
        .eq('company_code', companyCode.trim())
        .maybeSingle();

      if (findErr || !existingComp) {
        throw new Error('Invalid 6-digit Company ID. Check with your workspace admin.');
      }

      // 2. Trigger Supabase Magic Link OTP
      const { error: authErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (authErr) throw authErr;

      setMagicLinkSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send login link.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Paid Account Request to Supabase Queue
  const handleRequestAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: reqErr } = await supabase.from('account_requests').insert([
        {
          full_name: requestName.trim(),
          company_name: requestCompanyName.trim(),
          email: email.trim(),
          phone: requestPhone.trim(),
          status: 'pending'
        }
      ]);

      if (reqErr) throw reqErr;
      setRequestSubmitted(true);
    } catch (err) {
      // Fallback message if table doesn't exist yet
      setError(err.message || 'Failed to submit request. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#121824] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-400">
          {isRequestingAccount ? <UserPlus className="w-6 h-6" /> : <Mail className="w-6 h-6" />}
        </div>
        <h2 className="text-xl font-bold text-white">
          {isRequestingAccount ? 'Request Workspace Access' : 'Sign In via Magic Link'}
        </h2>
        <p className="text-xs text-slate-400">
          {isRequestingAccount
            ? 'TowCalc Pro is invite-only software. Fill out the form below to request a company workspace.'
            : 'Enter your email and 6-digit Company ID to receive an instant sign-in link.'}
        </p>
      </div>

      {/* SUCCESS MESSAGE: Magic Link Sent */}
      {magicLinkSent ? (
        <div className="p-6 bg-emerald-950/30 border border-emerald-800/50 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-sm font-bold text-emerald-300">Magic Link Sent!</h3>
          <p className="text-xs text-slate-300">
            Check <strong className="text-white">{email}</strong> for your secure login link.
          </p>
          <button
            type="button"
            onClick={() => setMagicLinkSent(false)}
            className="text-[11px] text-slate-400 hover:text-white underline pt-2 cursor-pointer"
          >
            Send another link
          </button>
        </div>
      ) : requestSubmitted ? (
        /* SUCCESS MESSAGE: Account Request Submitted */
        <div className="p-6 bg-blue-950/30 border border-blue-800/50 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-blue-400 mx-auto" />
          <h3 className="text-sm font-bold text-blue-300">Access Request Received</h3>
          <p className="text-xs text-slate-300">
            Thank you! Our team will process your company workspace and email your 6-digit Company ID to <strong className="text-white">{email}</strong>.
          </p>
          <button
            type="button"
            onClick={() => {
              setRequestSubmitted(false);
              setIsRequestingAccount(false);
            }}
            className="text-[11px] text-blue-400 hover:underline pt-2 cursor-pointer block mx-auto"
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

          {/* FORM 1: Existing User Magic Link Login */}
          {!isRequestingAccount ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                  Email Address
                </label>
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

              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                  6-Digit Company ID
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="e.g. 849201"
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    className="w-full bg-[#080c14] border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-bold text-xs text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {loading ? (
                  'Sending Link...'
                ) : (
                  <>
                    Send Magic Link
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* FORM 2: New Client Paid Account Request */
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
                    placeholder="(555) 555-0199"
                    value={requestPhone}
                    onChange={(e) => setRequestPhone(e.target.value)}
                    className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-bold text-xs text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 mt-2"
              >
                {loading ? 'Submitting Request...' : 'Submit Workspace Request'}
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setIsRequestingAccount(!isRequestingAccount);
                setError(null);
              }}
              className="text-xs text-blue-400 hover:underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {isRequestingAccount ? 'Already have a Company ID? Sign In' : 'Need an account for your business? Request access here'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}