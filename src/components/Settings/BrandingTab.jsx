import React, { useEffect, useRef, useState } from 'react';
import { Image, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { convertSvgLogoToPng } from '../../lib/logoImage';

export default function BrandingTab({ formData, profile, updateBranding }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const branding = formData.branding || {};

  useEffect(() => {
    let active = true;
    if (!branding.logo_path) { setPreviewUrl(''); return undefined; }
    supabase.storage.from('company-branding').createSignedUrl(branding.logo_path, 3600)
      .then(({ data }) => { if (active) setPreviewUrl(data?.signedUrl || ''); });
    return () => { active = false; };
  }, [branding.logo_path]);

  const uploadLogo = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !profile?.company_id) return;
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    if ((!['image/png', 'image/jpeg'].includes(file.type) && !isSvg) || file.size > 2 * 1024 * 1024) {
      setStatus({ error: true, message: 'Choose a PNG, JPG, or SVG logo smaller than 2 MB.' }); return;
    }
    setUploading(true); setStatus(null);
    try {
      const uploadFile = isSvg ? await convertSvgLogoToPng(file) : file;
      const extension = uploadFile.type === 'image/png' ? 'png' : 'jpg';
      const path = `${profile.company_id}/logo-${Date.now()}.${extension}`;
      const { data: existing } = await supabase.storage.from('company-branding').list(profile.company_id);
      const oldLogos = (existing || []).filter((item) => /^logo(?:-\d+)?\.(png|jpg|jpeg)$/i.test(item.name)).map((item) => `${profile.company_id}/${item.name}`);
      const { error } = await supabase.storage.from('company-branding').upload(path, uploadFile, { contentType: uploadFile.type, upsert: false });
      if (error) throw error;
      if (oldLogos.length) await supabase.storage.from('company-branding').remove(oldLogos);
      updateBranding('logo_path', path);
      const { data } = await supabase.storage.from('company-branding').createSignedUrl(path, 3600);
      setPreviewUrl(data?.signedUrl || '');
      setStatus({ message: isSvg ? 'SVG converted to PNG and uploaded. Click Save Settings to apply it.' : 'Logo uploaded. Click Save Settings to apply it to quote documents.' });
    } catch (error) { setStatus({ error: true, message: error.message }); }
    finally { setUploading(false); }
  };

  const field = (key, label, placeholder, type = 'text') => <label className="space-y-1"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span><input type={type} value={branding[key] ?? ''} onChange={(event) => updateBranding(key, event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" /></label>;

  return <div className="space-y-5 text-xs">
    <div className="rounded-xl border border-slate-800 bg-[#080c14] p-4"><h4 className="flex items-center gap-2 font-bold text-white"><Image className="h-4 w-4 text-blue-400" /> Quote Branding</h4><p className="mt-1 text-slate-400">Used on downloaded PDFs, quote emails, and dispatch requests for this company only.</p></div>
    <div className="grid gap-4 rounded-xl border border-slate-800 bg-[#080c14] p-4 sm:grid-cols-[12rem_1fr]">
      <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-white p-4">{previewUrl ? <img src={previewUrl} alt="Company logo preview" className="max-h-24 max-w-full object-contain" /> : <span className="text-center text-xs text-slate-500">No company logo</span>}</div>
      <div className="space-y-3"><input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/svg+xml,.svg" onChange={uploadLogo} /><button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50"><Upload className="h-4 w-4" />{uploading ? 'Converting and uploading...' : 'Upload PNG, JPG, or SVG'}</button><p className="text-[10px] text-slate-500">SVG files are safely converted to transparent PNG. Maximum 2 MB.</p>{status && <p className={status.error ? 'text-red-400' : 'text-emerald-400'}>{status.message}</p>}</div>
    </div>
    <div className="grid gap-3 rounded-xl border border-slate-800 bg-[#080c14] p-4 sm:grid-cols-2">
      {field('display_name', 'Company display name', 'Acme Towing')}{field('accent_color', 'Brand color', '#2563eb', 'color')}{field('phone', 'Phone', '(555) 555-0199')}{field('email', 'Email', 'quotes@company.com', 'email')}{field('website', 'Website', 'https://company.com')}{field('address', 'Business address', '123 Main St, City, ST')}
      <label className="space-y-1 sm:col-span-2"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">PDF footer / terms</span><textarea rows={3} value={branding.pdf_footer ?? ''} onChange={(event) => updateBranding('pdf_footer', event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#121824] px-3 py-2 text-white" /></label>
      <label className="flex items-center gap-2 text-slate-300 sm:col-span-2"><input type="checkbox" checked={branding.show_pricing_breakdown !== false} onChange={(event) => updateBranding('show_pricing_breakdown', event.target.checked)} /> Show mileage, hours, equipment class, and surcharge details on customer PDFs.</label>
    </div>
  </div>;
}
