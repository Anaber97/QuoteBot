import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Building, Plus, Trash2 } from 'lucide-react';

export default function ManagerOnboarding({ profile }) {
  const [clients, setClients] = useState([]);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch clients belonging to the manager's company
  useEffect(() => {
    async function fetchClients() {
      if (!profile?.company_id) return;
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', profile.company_id);

      if (!error && data) setClients(data);
    }
    fetchClients();
  }, [profile]);

  const handleAddClient = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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

      setClients([...clients, data]);
      setClientName('');
      setClientEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (clientId) => {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (!error) {
      setClients(clients.filter((c) => c.id !== clientId));
    }
  };

  return (
    <div className="space-y-6 bg-[#080c14] border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-400" />
            Client Sub-Accounts Management
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage external corporate clients who utilize your company's quoting portal.
          </p>
        </div>
        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg">
          Company ID: {profile?.company_id ? 'Active Workspace' : 'Loading...'}
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* Add Client Form */}
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
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Client Account
          </button>
        </div>
      </form>

      {/* Client List */}
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
  );
}
