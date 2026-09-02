alter table public.clients
  add column if not exists logo_path text;

comment on column public.clients.logo_path is
  'Private company-branding object path for this client account logo.';

drop policy if exists company_branding_select on storage.objects;
create policy company_branding_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'company-branding'
  and (storage.foldername(name))[1] = (select company_id::text from private.current_profile())
  and (
    (select role from private.current_profile()) <> 'client'
    or array_length(storage.foldername(name), 1) = 1
    or (
      (storage.foldername(name))[2] = 'clients'
      and (storage.foldername(name))[3] = (select client_id::text from private.current_profile())
    )
  )
);
