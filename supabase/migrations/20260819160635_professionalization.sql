-- Professional operations metadata, query indexes, and immutable quote events.
create sequence if not exists public.quote_reference_seq;

alter table public.quote_logs
  add column if not exists quote_reference text;

alter table public.quote_logs
  alter column quote_reference set default (
    'Q-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.quote_reference_seq')::text, 6, '0')
  );

update public.quote_logs
set quote_reference = 'Q-' || to_char(created_at, 'YYYY') || '-' || lpad(nextval('public.quote_reference_seq')::text, 6, '0')
where quote_reference is null;

alter table public.quote_logs alter column quote_reference set not null;
create unique index if not exists quote_logs_quote_reference_idx on public.quote_logs (quote_reference);
create index if not exists quote_logs_company_created_idx on public.quote_logs (company_id, created_at desc);
create index if not exists quote_logs_client_created_idx on public.quote_logs (client_id, created_at desc) where client_id is not null;
create index if not exists quote_logs_company_status_idx on public.quote_logs (company_id, status, created_at desc);

create table if not exists public.quote_events (
  id bigint generated always as identity primary key,
  quote_id uuid not null references public.quote_logs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created', 'status_changed', 'email_sent', 'bol_attached', 'bol_removed')),
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quote_events_quote_created_idx on public.quote_events (quote_id, created_at desc);
create index if not exists quote_events_company_created_idx on public.quote_events (company_id, created_at desc);
alter table public.quote_events enable row level security;

drop policy if exists "Company members can read quote events" on public.quote_events;
create policy "Company members can read quote events" on public.quote_events
for select to authenticated
using (
  company_id = (select p.company_id from public.profiles p where p.id = (select auth.uid()))
  and exists (
    select 1 from public.quote_logs q
    where q.id = quote_id
      and (
        (select p.role from public.profiles p where p.id = (select auth.uid())) in ('manager', 'dispatch')
        or q.client_id = (select p.client_id from public.profiles p where p.id = (select auth.uid()))
      )
  )
);

revoke all on public.quote_events from anon, authenticated;
grant select on public.quote_events to authenticated;
grant all on public.quote_events to service_role;
grant usage, select on sequence public.quote_reference_seq to service_role;
grant usage, select on sequence public.quote_events_id_seq to service_role;

create or replace function public.record_quote_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.quote_events (quote_id, company_id, actor_id, event_type, to_status)
    values (new.id, new.company_id, coalesce((select auth.uid()), new.user_id), 'created', new.status);
  elsif new.status is distinct from old.status then
    insert into public.quote_events (quote_id, company_id, actor_id, event_type, from_status, to_status)
    values (new.id, new.company_id, (select auth.uid()), 'status_changed', old.status, new.status);
  end if;
  return new;
end;
$$;

revoke all on function public.record_quote_event() from public, anon, authenticated;
grant execute on function public.record_quote_event() to service_role;

drop trigger if exists quote_event_audit_trigger on public.quote_logs;
create trigger quote_event_audit_trigger
after insert or update of status on public.quote_logs
for each row execute function public.record_quote_event();

-- These legacy administrative helpers are never valid anonymous RPC endpoints.
do $$
begin
  if to_regprocedure('public.update_my_default_base(text)') is not null then
    execute 'revoke execute on function public.update_my_default_base(text) from anon';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
