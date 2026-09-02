import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const trimTransparentPadding = async (url) => {
  if (!url || typeof createImageBitmap !== 'function') return { url, revoke: false };
  const response = await fetch(url);
  if (!response.ok) return { url, revoke: false };
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) { bitmap.close(); return { url, revoke: false }; }
  context.drawImage(bitmap, 0, 0); bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width; let right = -1; let top = canvas.height; let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[((y * canvas.width + x) * 4) + 3] < 8) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top || (left === 0 && top === 0 && right === canvas.width - 1 && bottom === canvas.height - 1)) {
    return { url, revoke: false };
  }
  const cropped = document.createElement('canvas');
  cropped.width = right - left + 1; cropped.height = bottom - top + 1;
  cropped.getContext('2d').drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  const blob = await new Promise((resolve) => cropped.toBlob(resolve, 'image/png'));
  return blob ? { url: URL.createObjectURL(blob), revoke: true } : { url, revoke: false };
};

export default function CoBranding({ companyLogoPath, clientLogoPath, companyName = 'Towing company', clientName = 'Client' }) {
  const [urls, setUrls] = useState({ company: '', client: '' });

  useEffect(() => {
    let active = true;
    const sign = async (path) => {
      if (!path) return '';
      const { data } = await supabase.storage.from('company-branding').createSignedUrl(path, 3600);
      return data?.signedUrl || '';
    };
    const generatedUrls = [];
    Promise.all([sign(companyLogoPath), sign(clientLogoPath)]).then(async ([companySigned, clientSigned]) => {
      const [companyResult, clientResult] = await Promise.allSettled([
        trimTransparentPadding(companySigned), trimTransparentPadding(clientSigned),
      ]);
      const company = companyResult.status === 'fulfilled' ? companyResult.value : { url: companySigned, revoke: false };
      const client = clientResult.status === 'fulfilled' ? clientResult.value : { url: clientSigned, revoke: false };
      if (company.revoke) generatedUrls.push(company.url);
      if (client.revoke) generatedUrls.push(client.url);
      if (active) setUrls({ company: company.url, client: client.url });
      else generatedUrls.forEach((url) => URL.revokeObjectURL(url));
    });
    return () => { active = false; generatedUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [companyLogoPath, clientLogoPath]);

  const logo = (url, name) => url
    ? <img src={url} alt={`${name} logo`} className="max-h-12 max-w-full object-contain" />
    : <span className="max-w-[9rem] truncate text-sm font-bold text-slate-700">{name}</span>;

  return <div aria-label={`${companyName} and ${clientName}`} className="grid min-h-20 grid-cols-[minmax(0,10rem)_auto_minmax(0,10rem)] items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
    <div className="flex h-12 items-center justify-end">{logo(urls.company, companyName)}</div>
    <span aria-hidden="true" className="self-center text-xl font-light leading-none text-slate-400">×</span>
    <div className="flex h-12 items-center justify-start">{logo(urls.client, clientName)}</div>
  </div>;
}
