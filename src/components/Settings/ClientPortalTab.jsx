import React, { useCallback, useEffect, useState } from 'react';
import { Building, Image, Plus, Save, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { convertSvgLogoToPng } from '../../lib/logoImage';
import Dialog from '../Dialog';

const emptyPricing = { use_custom_pricing: false, rounding_interval: 25, weight_tiers: [] };

const cloneWeightTiers = (tiers = []) => tiers.map((tier, index) => ({
  id: `client-tier-${Date.now()}-${index}`,
  label: tier.label || `Class ${index + 1}`,
  minWeight: Number(tier.minWeight ?? 0),
  maxWeight: Number(tier.maxWeight ?? 999999),
  rate: Number(tier.rate ?? 0),
  hourlyRate: Number(tier.hourlyRate ?? tier.rate ?? 0),
  mileageRate: Number(tier.mileageRate ?? 5),
  permitCost: Number(tier.permitCost ?? 150),
  drive_time_buffer: Number(tier.drive_time_buffer ?? 10),
  load_unload_base_mins: Number(tier.load_unload_base_mins ?? 30),
  rounding_interval: Number(tier.rounding_interval ?? 25),
}));

export default function ClientPortalTab({ formData, profile, updateClientPortal }) {
  const [clients, setClients] = useState([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [logoUrls, setLogoUrls] = useState({});
  const [uploadingClientId, setUploadingClientId] = useState(null);
  const defaultWeightTiers = formData.client_portal?.weight_tiers || [];

  const loadClients = useCallback(async () => {
    if (!profile?.company_id) return;
    const { data, error: loadError } = await supabase.from('clients').select('*').eq('company_id', profile.company_id).order('created_at');
    if (loadError) setError(loadError.message); else {
      const loaded = data || [];
      setClients(loaded);
      const signedEntries = await Promise.all(loaded.filter((client) => client.logo_path).map(async (client) => {
        const { data: signed } = await supabase.storage.from('company-branding').createSignedUrl(client.logo_path, 3600);
        return [client.id, signed?.signedUrl || ''];
      }));
      setLogoUrls(Object.fromEntries(signedEntries));
    }
  }, [profile?.company_id]);
  useEffect(() => { loadClients(); }, [loadClients]);

  const addClient = async (event) => {
    event.preventDefault(); setError('');
    const { data, error: insertError } = await supabase.from('clients').insert([{ company_id: profile.company_id, client_name: newName.trim(), contact_email: newEmail.trim(), pricing: { ...emptyPricing, weight_tiers: cloneWeightTiers(defaultWeightTiers) } }]).select().single();
    if (insertError) return setError(insertError.message);
    setClients((current) => [...current, data]); setNewName(''); setNewEmail('');
  };
  const updateClient = (id, field, value) => setClients((current) => current.map((client) => client.id === id ? { ...client, [field]: value } : client));
  const updatePricing = (id, field, value) => setClients((current) => current.map((client) => {
    if (client.id !== id) return client;
    const currentPricing = { ...emptyPricing, ...client.pricing };
    if (field === 'use_custom_pricing') {
      return {
        ...client,
        pricing: {
          ...currentPricing,
          use_custom_pricing: value,
          weight_tiers: value && (!Array.isArray(currentPricing.weight_tiers) || currentPricing.weight_tiers.length === 0)
            ? cloneWeightTiers(defaultWeightTiers)
            : currentPricing.weight_tiers,
        },
      };
    }
    return { ...client, pricing: { ...currentPricing, [field]: value === '' ? '' : Number(value) } };
  }));
  const updateClientTier = (clientId, tierIndex, field, value) => setClients((current) => current.map((client) => client.id === clientId ? {
    ...client,
    pricing: {
      ...emptyPricing,
      ...client.pricing,
      weight_tiers: (client.pricing?.weight_tiers || []).map((tier, index) => index === tierIndex
        ? { ...tier, [field]: field === 'label' ? value : Number(value) }
        : tier),
    },
  } : client));
  const addClientTier = (clientId) => setClients((current) => current.map((client) => client.id === clientId ? {
    ...client,
    pricing: {
      ...emptyPricing,
      ...client.pricing,
      weight_tiers: [...(client.pricing?.weight_tiers || []), { id: `client-tier-${Date.now()}`, label: 'New class', minWeight: 0, maxWeight: 999999, rate: 0, hourlyRate: 0, mileageRate: 5, permitCost: 150, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 }],
    },
  } : client));
  const removeClientTier = (clientId, tierIndex) => setClients((current) => current.map((client) => client.id === clientId ? {
    ...client,
    pricing: { ...emptyPricing, ...client.pricing, weight_tiers: (client.pricing?.weight_tiers || []).filter((_, index) => index !== tierIndex) },
  } : client));
  const saveClient = async (client) => {
    setError(''); setSuccess('');
    const { error: saveError } = await supabase.from('clients').update({ client_name: client.client_name, contact_email: client.contact_email, contact_phone: client.contact_phone, pricing: client.pricing || emptyPricing }).eq('id', client.id).eq('company_id', profile.company_id);
    if (saveError) setError(saveError.message); else setSuccess(`${client.client_name} saved.`);
  };
  const uploadClientLogo = async (client, event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    if ((!['image/png', 'image/jpeg'].includes(file.type) && !isSvg) || file.size > 2 * 1024 * 1024) {
      setError('Choose a PNG, JPG, or SVG logo smaller than 2 MB.'); return;
    }
    setError(''); setSuccess(''); setUploadingClientId(client.id);
    let path = '';
    try {
      const uploadFile = isSvg ? await convertSvgLogoToPng(file) : file;
      const extension = uploadFile.type === 'image/png' ? 'png' : 'jpg';
      path = `${profile.company_id}/clients/${client.id}/logo-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('company-branding').upload(path, uploadFile, { contentType: uploadFile.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: saveError } = await supabase.from('clients').update({ logo_path: path }).eq('id', client.id).eq('company_id', profile.company_id);
      if (saveError) throw saveError;
      if (client.logo_path) await supabase.storage.from('company-branding').remove([client.logo_path]);
      updateClient(client.id, 'logo_path', path);
      const { data: signed } = await supabase.storage.from('company-branding').createSignedUrl(path, 3600);
      setLogoUrls((current) => ({ ...current, [client.id]: signed?.signedUrl || '' }));
      setSuccess(`${client.client_name} logo uploaded${isSvg ? ' and converted to PNG' : ''}.`);
    } catch (uploadError) {
      if (path) await supabase.storage.from('company-branding').remove([path]);
      setError(uploadError.message);
    } finally { setUploadingClientId(null); }
  };
  const removeClientLogo = async (client) => {
    setError(''); setSuccess('');
    const { error: saveError } = await supabase.from('clients').update({ logo_path: null }).eq('id', client.id).eq('company_id', profile.company_id);
    if (saveError) return setError(saveError.message);
    if (client.logo_path) await supabase.storage.from('company-branding').remove([client.logo_path]);
    updateClient(client.id, 'logo_path', null);
    setLogoUrls((current) => ({ ...current, [client.id]: '' }));
    setSuccess(`${client.client_name} logo removed.`);
  };
  const deleteClient = async (id) => {
    const client = clients.find((item) => item.id === id);
    const { error: deleteError } = await supabase.from('clients').delete().eq('id', id).eq('company_id', profile.company_id);
    if (deleteError) return setError(deleteError.message);
    if (client?.logo_path) await supabase.storage.from('company-branding').remove([client.logo_path]);
    setClients((current) => current.filter((client) => client.id !== id));
  };

  return <div className="space-y-5 text-xs">
    <div className="rounded-xl border border-slate-800 bg-[#080c14] p-3.5 space-y-3">
      <h4 className="font-bold text-slate-200">Your Contact Details</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={formData.client_portal?.contact_phone ?? ''} onChange={(e) => updateClientPortal('contact_phone', e.target.value)} placeholder="Contact phone" className="rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" />
        <input value={formData.client_portal?.contact_email ?? ''} onChange={(e) => updateClientPortal('contact_email', e.target.value)} placeholder="Contact email" className="rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" />
        <label className="flex items-center gap-2 sm:col-span-2 text-slate-300"><input type="checkbox" checked={formData.client_portal?.send_jobs_to_contact_email !== false} onChange={(e) => updateClientPortal('send_jobs_to_contact_email', e.target.checked)} /> Send jobs to contact email</label>
        {formData.client_portal?.send_jobs_to_contact_email === false && <label className="space-y-1 sm:col-span-2"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Dispatch email</span><input type="email" required value={formData.client_portal?.dispatch_email ?? ''} onChange={(e) => updateClientPortal('dispatch_email', e.target.value)} placeholder="dispatch@company.com" className="w-full rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" /></label>}
        <label className="space-y-1 sm:col-span-2">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Manual Quote Threshold (lbs)</span>
          <input type="number" value={formData.client_portal?.approval_threshold ?? 80001} onChange={(e) => updateClientPortal('approval_threshold', Number(e.target.value) || 80001)} placeholder="e.g. 80,001" className="w-full rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" />
          <span className="block text-[10px] text-slate-500">Equipment at or above this weight requires manual review.</span>
        </label>
      </div>
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
        <div className="mt-3 grid gap-3 rounded-xl border border-slate-800 bg-[#080c14] p-3 sm:grid-cols-[9rem_1fr]">
          <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-white p-2">
            {logoUrls[client.id] ? <img src={logoUrls[client.id]} alt={`${client.client_name} logo preview`} className="max-h-16 max-w-full object-contain" /> : <Image className="h-6 w-6 text-slate-400" />}
          </div>
          <div className="flex flex-wrap content-center items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-500/30 px-3 py-2 font-semibold text-blue-300">
              <Upload className="h-3.5 w-3.5" /> {uploadingClientId === client.id ? 'Uploading...' : 'Upload client logo'}
              <input hidden disabled={Boolean(uploadingClientId)} type="file" accept="image/png,image/jpeg,image/svg+xml,.svg" onChange={(event) => uploadClientLogo(client, event)} />
            </label>
            {client.logo_path && <button type="button" onClick={() => removeClientLogo(client)} className="rounded-lg border border-red-500/30 px-3 py-2 text-red-300">Remove logo</button>}
            <p className="basis-full text-[10px] text-slate-500">PNG, JPG, or SVG up to 2 MB. SVG is safely converted to PNG.</p>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300"><input type="checkbox" checked={client.pricing?.use_custom_pricing === true} onChange={(e) => updatePricing(client.id, 'use_custom_pricing', e.target.checked)} /> Use custom pricing for this client</label>
        {client.pricing?.use_custom_pricing === true && <div className="mt-3 space-y-2 rounded-xl border border-slate-800 bg-[#080c14] p-3">
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Client Equipment Weight Pricing</p><p className="text-[10px] text-slate-500">Overrides the company equipment table for this client.</p></div>
            <button type="button" onClick={() => addClientTier(client.id)} className="rounded-lg border border-blue-500/30 px-2.5 py-1.5 text-blue-300"><Plus className="inline h-3 w-3" /> Add class</button>
          </div>
          <div className="hidden gap-2 px-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[1fr_1fr_1fr_0.8fr_0.9fr_0.9fr_auto]"><span>Class</span><span>Min lbs</span><span>Max lbs</span><span>$/hr</span><span>Buffer %</span><span>Load min</span><span /></div>
          {(client.pricing?.weight_tiers || []).map((tier, tierIndex) => <div key={tier.id || tierIndex} className="grid gap-2 rounded-lg border border-slate-800 bg-[#121824] p-2 lg:grid-cols-[1fr_1fr_1fr_0.8fr_0.9fr_0.9fr_auto]">
            <input value={tier.label || ''} onChange={(e) => updateClientTier(client.id, tierIndex, 'label', e.target.value)} placeholder="Class name" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
            <input type="number" value={tier.minWeight ?? 0} onChange={(e) => updateClientTier(client.id, tierIndex, 'minWeight', e.target.value)} placeholder="Min lbs" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
            <input type="number" value={tier.maxWeight ?? 999999} onChange={(e) => updateClientTier(client.id, tierIndex, 'maxWeight', e.target.value)} placeholder="Max lbs" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
            <input type="number" value={tier.rate ?? 0} onChange={(e) => updateClientTier(client.id, tierIndex, 'rate', e.target.value)} placeholder="$/hr" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
            <input type="number" value={tier.drive_time_buffer ?? 10} onChange={(e) => updateClientTier(client.id, tierIndex, 'drive_time_buffer', e.target.value)} placeholder="Buffer %" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
            <input type="number" value={tier.load_unload_base_mins ?? 30} onChange={(e) => updateClientTier(client.id, tierIndex, 'load_unload_base_mins', e.target.value)} placeholder="Load min" className="rounded border border-slate-700 bg-[#080c14] p-2 text-white" />
            <button type="button" onClick={() => removeClientTier(client.id, tierIndex)} className="rounded border border-red-500/30 px-2 text-red-300" title="Delete class"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>)}
        </div>}
        <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setPendingDelete(client)} className="rounded-lg border border-red-500/30 px-3 py-2 text-red-300"><Trash2 className="inline h-3.5 w-3.5" /> Delete</button><button type="button" onClick={() => saveClient(client)} className="rounded-lg border border-emerald-500/30 px-3 py-2 text-emerald-300"><Save className="inline h-3.5 w-3.5" /> Save client</button></div>
      </details>)}
    </div>
    <Dialog open={Boolean(pendingDelete)} title="Remove client account?" confirmLabel="Remove account" destructive onClose={() => setPendingDelete(null)} onConfirm={() => { const id = pendingDelete?.id; setPendingDelete(null); if (id) deleteClient(id); }}>
      <p>Remove <strong>{pendingDelete?.client_name}</strong>? Assigned users will no longer have a client account.</p>
    </Dialog>
  </div>;
}
