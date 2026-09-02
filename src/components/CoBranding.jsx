import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function CoBranding({ companyLogoPath, clientLogoPath, companyName = 'Towing company', clientName = 'Client' }) {
  const [urls, setUrls] = useState({ company: '', client: '' });

  useEffect(() => {
    let active = true;
    const sign = async (path) => {
      if (!path) return '';
      const { data } = await supabase.storage.from('company-branding').createSignedUrl(path, 3600);
      return data?.signedUrl || '';
    };
    Promise.all([sign(companyLogoPath), sign(clientLogoPath)]).then(([company, client]) => {
      if (active) setUrls({ company, client });
    });
    return () => { active = false; };
  }, [companyLogoPath, clientLogoPath]);

  const logo = (url, name) => url
    ? <img src={url} alt={`${name} logo`} className="max-h-12 max-w-[9rem] object-contain" />
    : <span className="max-w-[9rem] truncate text-sm font-bold text-slate-700">{name}</span>;

  return <div aria-label={`${companyName} and ${clientName}`} className="flex min-h-16 items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2">
    {logo(urls.company, companyName)}
    <span aria-hidden="true" className="text-xl font-light text-slate-400">×</span>
    {logo(urls.client, clientName)}
  </div>;
}
