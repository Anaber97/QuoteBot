import React, { useEffect, useState } from 'react';
import { Building, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const emptyPricing = { use_custom_pricing: false, hourly_min: '', hourly_max: '', rounding_interval: 25, drive_time_buffer: 10, load_unload_base_mins: 30 };

export default function ClientPortalTab({ formData, profile, updateClientPortal, onSaveConfig, isSaving }) {
  const [clients, setClients] = useState([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadClients = async () => {
    if (!profile?.company_id) return;
    const { data, error: loadError } = await supabase.from('clients').select('*').eq('company_id', profile.company_id).order('created_at');
    if (loadError) setError(loadError.message); else setClients(data || []);
  };
  useEffect(() => { loadClients(); }, [profile?.company_id]);

  const addClient = async (event) => {
    event.preventDefault(); setError('');
    const { data, error: insertError } = await supabase.from('clients').insert([{ company_id: profile.company_id, client_name: newName.trim(), contact_email: newEmail.trim(), pricing: emptyPricing }]).select().single();
    if (insertError) return setError(insertError.message);
    setClients((current) => [...current, data]); setNewName(''); setNewEmail('');
  };
  const updateClient = (id, field, value) => setClients((current) => current.map((client) => client.id === id ? { ...client, [field]: value } : client));
  const updatePricing = (id, field, value) => setClients((current) => current.map((client) => client.id === id ? { ...client, pricing: { ...emptyPricing, ...client.pricing, [field]: typeof value === 'boolean' ? value : value === '' ? '' : Number(value) } } : client));
  const saveClient = async (client) => {
    setError(''); setSuccess('');
    const { error: saveError } = await supabase.from('clients').update({ client_name: client.client_name, contact_email: client.contact_email, contact_phone: client.contact_phone, pricing: client.pricing || emptyPricing }).eq('id', client.id).eq('company_id', profile.company_id);
    if (saveError) setError(saveError.message); else setSuccess(`${client.client_name} saved.`);
  };
  const deleteClient = async (id) => {
    if (!window.confirm('Remove this client account? Assigned users will no longer have a client account.')) return;
    const { error: deleteError } = await supabase.from('clients').delete().eq('id', id).eq('company_id', profile.company_id);
    if (deleteError) return setError(deleteError.message);
    setClients((current) => current.filter((client) => client.id !== id));
  };

  return <div className="space-y-5 text-xs">
    <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3.5 space-y-3">
      <h4 className="font-bold text-slate-200">Your Contact Details</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={formData.client_portal?.contact_phone ?? ''} onChange={(e) => updateClientPortal('contact_phone', e.target.value)} placeholder="Contact phone" className="rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" />
        <input value={formData.client_portal?.contact_email ?? ''} onChange={(e) => updateClientPortal('contact_email', e.target.value)} placeholder="Contact email" className="rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" />
        <input type="number" value={formData.client_portal?.approval_threshold ?? 80001} onChange={(e) => updateClientPortal('approval_threshold', Number(e.target.value) || 80001)} placeholder="Human quote threshold (lbs)" className="rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" />
      </div>
      <button type="button" onClick={onSaveConfig} disabled={isSaving} className="light-save-portal rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-300">{isSaving ? 'Saving...' : 'Save portal details'}</button>
    </div>
    <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3.5 space-y-4">
      <div><h4 className="flex items-center gap-2 font-bold text-white"><Building className="h-4 w-4 text-blue-400" /> Client Accounts</h4><p className="mt-1 text-slate-400">Each account belongs only to this company. Create the account here, then invite its user in Users & Roles and choose this account.</p></div>
      {error && <p className="rounded-lg border border-red-800/50 bg-red-950/40 p-2 text-red-300">{error}</p>}
      {success && <p className="rounded-lg border border-emerald-800/50 bg-emerald-950/40 p-2 text-emerald-300">{success}</p>}
      <form onSubmit={addClient} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Client company name" className="rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" />
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Main contact email" className="rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" />
        <button className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white"><Plus className="inline h-3.5 w-3.5" /> Add account</button>
      </form>
      {clients.map((client) => <details key={client.id} className="rounded-lg border border-slate-800 bg-[#121824] p-3">
        <summary className="cursor-pointer font-semibold text-white">{client.client_name || 'Unnamed client account'}</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={client.client_name || ''} onChange={(e) => updateClient(client.id, 'client_name', e.target.value)} placeholder="Client name" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input value={client.contact_email || ''} onChange={(e) => updateClient(client.id, 'contact_email', e.target.value)} placeholder="Contact email" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input value={client.contact_phone || ''} onChange={(e) => updateClient(client.id, 'contact_phone', e.target.value)} placeholder="Contact phone" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
        </div>
        <label className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300"><input type="checkbox" checked={client.pricing?.use_custom_pricing === true} onChange={(e) => updatePricing(client.id, 'use_custom_pricing', e.target.checked)} /> Use custom pricing for this client</label>
        {client.pricing?.use_custom_pricing === true && <><p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Client-specific pricing</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <input type="number" value={client.pricing?.hourly_min ?? ''} onChange={(e) => updatePricing(client.id, 'hourly_min', e.target.value)} placeholder="Min $/hr" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" value={client.pricing?.hourly_max ?? ''} onChange={(e) => updatePricing(client.id, 'hourly_max', e.target.value)} placeholder="Max $/hr" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" value={client.pricing?.drive_time_buffer ?? 10} onChange={(e) => updatePricing(client.id, 'drive_time_buffer', e.target.value)} placeholder="Drive buffer %" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
          <input type="number" value={client.pricing?.load_unload_base_mins ?? 30} onChange={(e) => updatePricing(client.id, 'load_unload_base_mins', e.target.value)} placeholder="Load minutes" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
        </div></>}
        <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => deleteClient(client.id)} className="rounded-lg border border-red-500/30 px-3 py-2 text-red-300"><Trash2 className="inline h-3.5 w-3.5" /> Delete</button><button type="button" onClick={() => saveClient(client)} className="rounded-lg border border-emerald-500/30 px-3 py-2 text-emerald-300"><Save className="inline h-3.5 w-3.5" /> Save client</button></div>
      </details>)}
    </div>
  </div>;
}
