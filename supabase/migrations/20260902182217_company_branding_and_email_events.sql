insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-branding', 'company-branding', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists company_branding_select on storage.objects;
create policy company_branding_select on storage.objects for select to authenticated
using (bucket_id = 'company-branding' and (storage.foldername(name))[1] = (select company_id::text from private.current_profile()));

drop policy if exists company_branding_insert on storage.objects;
create policy company_branding_insert on storage.objects for insert to authenticated
with check (bucket_id = 'company-branding' and (storage.foldername(name))[1] = (select company_id::text from private.current_profile()) and (select role from private.current_profile()) = 'manager');

drop policy if exists company_branding_update on storage.objects;
create policy company_branding_update on storage.objects for update to authenticated
using (bucket_id = 'company-branding' and (storage.foldername(name))[1] = (select company_id::text from private.current_profile()) and (select role from private.current_profile()) = 'manager')
with check (bucket_id = 'company-branding' and (storage.foldername(name))[1] = (select company_id::text from private.current_profile()) and (select role from private.current_profile()) = 'manager');

drop policy if exists company_branding_delete on storage.objects;
create policy company_branding_delete on storage.objects for delete to authenticated
using (bucket_id = 'company-branding' and (storage.foldername(name))[1] = (select company_id::text from private.current_profile()) and (select role from private.current_profile()) = 'manager');

alter table public.quote_events drop constraint if exists quote_events_event_type_check;
alter table public.quote_events add constraint quote_events_event_type_check check (
  event_type in ('created', 'status_changed', 'email_sent', 'dispatch_requested', 'bol_attached', 'bol_removed')
);
