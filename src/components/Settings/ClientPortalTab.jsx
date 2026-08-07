import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Building, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const ROUNDING_OPTIONS = [
  { label: 'Exact ($1)', value: 1 },
  { label: 'Nearest $5', value: 5 },
  { label: 'Nearest $10', value: 10 },
  { label: 'Nearest $25 (Default)', value: 25 },
];

export default function ClientPortalTab({
  formData,
  profile,
  updateClientPortal,
  updateClientPortalTier,
  addClientPortalClient,
  removeClientPortalClient,
  updateClientPortalClient,
  updateClientPortalClientPricing,
  onSaveConfig,
  isSaving,
}) {
  const [clients, setClients] = useState([]);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState(null);

  useEffect(() => {
    async function fetchClients() {
      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true });

      if (!error && data) setClients(data);
    }

    fetchClients();
  }, [profile?.company_id]);

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!profile?.company_id) return;

    setClientLoading(true);
    setClientError(null);

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([
          {
            company_id: profile.company_id,
            client_name: clientName.trim(),
            contact_email: clientEmail.trim(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setClients((prev) => [...prev, data]);
      setClientName('');
      setClientEmail('');
    } catch (error) {
      setClientError(error.message);
    } finally {
      setClientLoading(false);
    }
  };

  const handleDeleteClient = async (clientId) => {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (!error) {
      setClients((prev) => prev.filter((client) => client.id !== clientId));
    }
  };

  const clientProfiles = (formData.client_portal?.clients || []).filter((client) => {
    const clientCompanyId = client.company_id || null;
    return clientCompanyId === profile?.company_id;
  });

  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3.5 space-y-3">
        <h4 className="font-bold text-slate-200">Client Quote Settings</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] text-slate-400">Contact Phone</label>
            <input
              type="text"
              value={formData.client_portal?.contact_phone ?? ''}
              onChange={(e) => updateClientPortal('contact_phone', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-slate-400">Contact Email</label>
            <input
              type="email"
              value={formData.client_portal?.contact_email ?? ''}
              onChange={(e) => updateClientPortal('contact_email', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-slate-400">Custom Approval Threshold (lbs)</label>
            <input
              type="number"
              value={formData.client_portal?.approval_threshold ?? 80000}
              onChange={(e) => updateClientPortal('approval_threshold', Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] text-slate-400">Quote Disclosure</label>
            <textarea
              rows="3"
              value={formData.client_portal?.disclosure ?? ''}
              onChange={(e) => updateClientPortal('disclosure', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#121824] px-2.5 py-2 text-white"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-200">Client Pricing Profiles</h4>
            <p className="text-[10px] text-slate-500">Create client sub-accounts and override pricing values without affecting the shared workspace defaults.</p>
          </div>
          <button
            type="button"
            onClick={addClientPortalClient}
            className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-2 text-[11px] font-semibold text-blue-400 transition hover:bg-blue-500/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Client
          </button>
          <button
            type="button"
            onClick={onSaveConfig}
            disabled={isSaving}
            className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {clientProfiles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-[#121824] p-3 text-center text-[11px] text-slate-500">
            No client-specific pricing profiles yet. Add a client to create per-account overrides.
          </div>
        ) : (
          <div className="space-y-3">
            {clientProfiles.map((client, index) => (
              <div key={client.id || index} className="rounded-lg border border-slate-800 bg-[#121824] p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-400">Client Name</label>
                        <input
                          type="text"
                          value={client.client_name || ''}
                          onChange={(e) => updateClientPortalClient(client.id, 'client_name', e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2.5 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-400">Contact Email</label>
                        <input
                          type="email"
                          value={client.contact_email || ''}
                          onChange={(e) => updateClientPortalClient(client.id, 'contact_email', e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2.5 py-2 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-400">Contact Phone</label>
                        <input
                          type="text"
                          value={client.contact_phone || ''}
                          onChange={(e) => updateClientPortalClient(client.id, 'contact_phone', e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2.5 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-400">Approval Threshold (lbs)</label>
                        <input
                          type="number"
                          value={client.approval_threshold ?? ''}
                          onChange={(e) => updateClientPortalClient(client.id, 'approval_threshold', e.target.value === '' ? null : Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2.5 py-2 text-white"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeClientPortalClient(client.id)}
                    className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:border-red-500/40 hover:text-red-400"
                    title="Remove client"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-400">Hourly Min</label>
                    <input
                      type="number"
                      value={client.pricing?.hourly_min ?? ''}
                      onChange={(e) => updateClientPortalClientPricing(client.id, 'hourly_min', e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2.5 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-400">Hourly Max</label>
                    <input
                      type="number"
                      value={client.pricing?.hourly_max ?? ''}
                      onChange={(e) => updateClientPortalClientPricing(client.id, 'hourly_max', e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2.5 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-400">Rounding Interval</label>
                    <select
                      value={client.pricing?.rounding_interval ?? 25}
                      onChange={(e) => updateClientPortalClientPricing(client.id, 'rounding_interval', e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2.5 py-2 text-white"
                    >
                      {ROUNDING_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Leave any field empty to fall back to the shared workspace pricing defaults.</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3.5 space-y-3">
        <h4 className="font-bold text-slate-200">Weight-based Hourly Rates</h4>
        <p className="text-[10px] text-slate-500">These tiers control the client-facing quote rate and time assumptions whenever a load weight is entered.</p>
        {(formData.client_portal?.weight_tiers || []).map((tier, index) => (
          <div key={tier.id || index} className="grid gap-2 rounded-lg border border-slate-800 bg-[#121824] p-2.5 sm:grid-cols-[1.1fr_0.8fr_0.8fr_0.7fr_0.9fr_0.8fr_0.9fr]">
            <div>
              <label className="mb-1 block text-[10px] text-slate-400">Label</label>
              <input
                type="text"
                value={tier.label}
                onChange={(e) => updateClientPortalTier(index, 'label', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-400">Min lbs</label>
              <input
                type="number"
                value={tier.minWeight}
                onChange={(e) => updateClientPortalTier(index, 'minWeight', Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-400">Max lbs</label>
              <input
                type="number"
                value={tier.maxWeight}
                onChange={(e) => updateClientPortalTier(index, 'maxWeight', Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-400">Rate $/hr</label>
              <input
                type="number"
                value={tier.rate}
                onChange={(e) => updateClientPortalTier(index, 'rate', Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-400">Drive Buffer (%)</label>
              <input
                type="number"
                step="1"
                value={tier.drive_time_buffer ?? 10}
                onChange={(e) => updateClientPortalTier(index, 'drive_time_buffer', Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-400">Load Time (mins)</label>
              <input
                type="number"
                value={tier.load_unload_base_mins ?? 30}
                onChange={(e) => updateClientPortalTier(index, 'load_unload_base_mins', Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-700 bg-[#080c14] px-2 py-2 text-white"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6 rounded-xl border border-slate-800 bg-[#080c14] p-3.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" />
              Client Sub-Accounts Management
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage external corporate clients who utilize your company's quoting portal.
            </p>
          </div>
          <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg">
            Company ID: {profile?.company_id ? 'Active Workspace' : 'Loading...'}
          </span>
        </div>

        {clientError && (
          <div className="p-3 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs">
            {clientError}
          </div>
        )}

        <form onSubmit={handleAddClient} className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#121824] p-4 rounded-xl border border-slate-800">
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Client / Business Name</label>
            <input
              type="text"
              required
              placeholder="e.g. ACME Corp."
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-[#080c14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Contact Email</label>
            <input
              type="email"
              placeholder="contact@acme.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full bg-[#080c14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={clientLoading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Client Account
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active Client Sub-Accounts</h4>
          {clients.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center bg-[#121824] rounded-xl border border-slate-800/60">
              No client sub-accounts created yet. Add a client above to get started!
            </p>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center justify-between bg-[#121824] border border-slate-800 p-3 rounded-xl">
                  <div>
                    <h5 className="text-xs font-bold text-white flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      {client.client_name}
                    </h5>
                    <p className="text-[11px] text-slate-400">{client.contact_email || 'No email provided'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteClient(client.id)}
                    className="text-slate-500 hover:text-red-400 p-1.5 transition cursor-pointer"
                    title="Remove Client"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
