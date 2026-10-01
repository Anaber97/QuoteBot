import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { authenticatedFetch } from '../../lib/api';
import { DEFAULT_CONFIG, normalizeConfig } from '../../lib/configSchema';

/** Load a workspace atomically; late responses cannot restore a signed-out identity. */
export function useWorkspaceSession(onIdentityChange) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [companyRates, setCompanyRates] = useState(() => normalizeConfig(DEFAULT_CONFIG));
  const [profileLoadError, setProfileLoadError] = useState(null);
  const resetRef = useRef(onIdentityChange);
  resetRef.current = onIdentityChange;

  useEffect(() => {
    let disposed = false;
    let identity;
    let revision = 0;
    let authEvents = 0;
    const clearWorkspace = () => {
      setProfile(null);
      setCompanyRates(normalizeConfig(DEFAULT_CONFIG));
      setProfileLoadError(null);
    };
    const loadWorkspace = async (userId, expectedRevision) => {
      const isCurrent = () => !disposed && revision === expectedRevision;
      try {
        const { data: nextProfile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (error || !nextProfile?.company_id) throw error || new Error('Missing workspace');
        let config = null;
        try {
          const params = new URLSearchParams({ company_id: nextProfile.company_id });
          const response = await authenticatedFetch(`/api/appConfig?${params}`);
          const body = await response.json();
          if (response.ok) config = body.config;
        } catch { /* Staff can recover from a temporary API outage using RLS-protected reads. */ }
        if (!config && nextProfile.role !== 'client') {
          const result = await supabase.from('app_config').select('*').eq('company_id', nextProfile.company_id).maybeSingle();
          if (!result.error) config = result.data;
        }
        if (!config && nextProfile.role === 'client') throw new Error('Portal unavailable');
        if (config) {
          const result = await supabase.from('clients')
            .select('id, company_id, client_name, contact_email, contact_phone, approval_threshold, pricing, logo_path')
            .eq('company_id', nextProfile.company_id);
          if (!result.error) config = { ...config, client_portal: { ...config.client_portal, clients: result.data || [] } };
        }
        if (!isCurrent()) return;
        setProfile(nextProfile);
        setCompanyRates(normalizeConfig(config || DEFAULT_CONFIG));
      } catch {
        if (!isCurrent()) return;
        clearWorkspace();
        setProfileLoadError('We could not load your account profile. Please refresh the page or sign in again.');
      }
    };
    const adoptSession = (nextSession) => {
      if (disposed) return;
      setSession(nextSession);
      const nextIdentity = nextSession?.user?.id || null;
      // Token refresh must not recursively trigger another protected config fetch.
      if (identity === nextIdentity) return;
      identity = nextIdentity;
      revision += 1;
      clearWorkspace();
      resetRef.current();
      if (identity) {
        const nextRevision = revision;
        // Run outside the Auth callback's lock.
        queueMicrotask(() => { if (!disposed) void loadWorkspace(nextIdentity, nextRevision); });
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEvents += 1;
      adoptSession(nextSession);
    });
    const initialEventCount = authEvents;
    supabase.auth.getSession().then(({ data }) => {
      if (authEvents === initialEventCount) adoptSession(data?.session || null);
    }).catch(() => {
      if (!disposed) setProfileLoadError('We could not restore your session. Please sign in again.');
    });
    return () => { disposed = true; revision += 1; subscription.unsubscribe(); };
  }, []);

  return { session, profile, companyRates, setCompanyRates, profileLoadError };
}
