alter table public.quote_logs
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists quote_source text not null default 'main_calculator'
    check (quote_source in ('main_calculator', 'equipment_calculator', 'client_portal')),
  add column if not exists quote_details jsonb not null default '{}'::jsonb,
  add column if not exists bol_path text,
  add column if not exists bol_name text,
  add column if not exists bol_type text;

create index if not exists quote_logs_client_portal_idx
  on public.quote_logs (company_id, client_id, quote_source, created_at desc);

grant update on public.quote_logs to authenticated;

drop policy if exists quote_logs_select_scope on public.quote_logs;
create policy quote_logs_select_scope on public.quote_logs for select to authenticated
using (
  company_id = (select company_id from private.current_profile())
  and (
    (select role from private.current_profile()) <> 'client'
    or (quote_source = 'client_portal' and client_id = (select client_id from private.current_profile()))
  )
);

drop policy if exists quote_logs_insert_own on public.quote_logs;
create policy quote_logs_insert_own on public.quote_logs for insert to authenticated
with check (
  company_id = (select company_id from private.current_profile())
  and user_id = (select auth.uid())
  and (
    ((select role from private.current_profile()) = 'client' and quote_source = 'client_portal' and client_id = (select client_id from private.current_profile()))
    or ((select role from private.current_profile()) <> 'client' and quote_source <> 'client_portal' and client_id is null)
  )
);

create policy quote_logs_update_scope on public.quote_logs for update to authenticated
using (
  company_id = (select company_id from private.current_profile())
  and (
    (select role from private.current_profile()) <> 'client'
    or (quote_source = 'client_portal' and client_id = (select client_id from private.current_profile()))
  )
)
with check (
  company_id = (select company_id from private.current_profile())
  and (
    (select role from private.current_profile()) <> 'client'
    or (quote_source = 'client_portal' and client_id = (select client_id from private.current_profile()))
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-bols', 'quote-bols', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy quote_bols_select on storage.objects for select to authenticated
using (
  bucket_id = 'quote-bols'
  and exists (
    select 1 from public.quote_logs q
    where q.id::text = (storage.foldername(name))[2]
      and q.company_id = (select company_id from private.current_profile())
      and ((select role from private.current_profile()) <> 'client' or (q.quote_source = 'client_portal' and q.client_id = (select client_id from private.current_profile())))
  )
);

create policy quote_bols_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'quote-bols'
  and (storage.foldername(name))[1] = (select company_id::text from private.current_profile())
  and exists (
    select 1 from public.quote_logs q
    where q.id::text = (storage.foldername(name))[2]
      and q.company_id = (select company_id from private.current_profile())
      and ((select role from private.current_profile()) <> 'client' or (q.quote_source = 'client_portal' and q.client_id = (select client_id from private.current_profile())))
  )
);
