import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function InviteRegister() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const inviteParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams('');
  const inviteToken = inviteParams.get('invite') || '';
  const inviteRoleFromQuery = inviteParams.get('role') || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!inviteToken) {
      setMessage({ type: 'error', text: 'This invite link is missing its token.' });
      setLoading(false);
      return;
    }

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setMessage({ type: 'error', text: 'Please complete all fields.' });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      setLoading(false);
      return;
    }

    try {
      const { data: inviteData, error: inviteError } = await supabase
        .from('company_invites')
        .select('*')
        .eq('token', inviteToken)
        .maybeSingle();

      if (inviteError) throw inviteError;
      if (!inviteData && !inviteRoleFromQuery) {
        throw new Error('This invite is no longer valid. Please request a new one.');
      }
      if (inviteData && inviteData.status !== 'pending') {
        throw new Error('This invite is no longer valid. Please request a new one.');
      }

      const cleanedEmail = email.trim().toLowerCase();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (authError) throw authError;

      const userId = authData?.user?.id;
      if (!userId) {
        throw new Error('The account could not be created yet. Please try again.');
      }

      const resolvedRole = (inviteRoleFromQuery || inviteData?.role || 'member').toLowerCase();
      const resolvedCompanyId = inviteData?.company_id || null;

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: userId,
          email: cleanedEmail,
          full_name: fullName.trim(),
          company_id: resolvedCompanyId,
          role: resolvedRole,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (profileError) throw profileError;

      if (inviteData?.id) {
        const { error: inviteUpdateError } = await supabase
          .from('company_invites')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            accepted_by: userId,
          })
          .eq('id', inviteData.id);

        if (inviteUpdateError) throw inviteUpdateError;
      }

      setMessage({ type: 'success', text: 'Account created successfully. You can sign in now.' });
      window.location.assign('/');
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Unable to complete registration.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-12 text-slate-100">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-[#121824] p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-blue-500/20 bg-blue-600/10 text-blue-400">
            <LogIn className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Complete Your Invitation</h2>
          <p className="mt-1 text-xs text-slate-400">Create your account and join the workspace.</p>
        </div>

        {message && (
          <div className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${message.type === 'success' ? 'border-emerald-800/40 bg-emerald-950/30 text-emerald-300' : 'border-red-800/40 bg-red-950/30 text-red-300'}`}>
            {message.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#080c14] px-3 py-2.5 text-sm text-white"
              placeholder="Alex Johnson"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#080c14] px-3 py-2.5 text-sm text-white"
              placeholder="alex@company.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#080c14] px-3 py-2.5 text-sm text-white"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#080c14] px-3 py-2.5 text-sm text-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
