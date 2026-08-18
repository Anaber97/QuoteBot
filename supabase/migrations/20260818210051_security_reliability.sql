create table if not exists public.account_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  company_name text not null check (char_length(trim(company_name)) between 2 and 160),
  email text not null check (email = lower(email) and char_length(email) between 5 and 254),
  phone text not null default '' check (char_length(phone) <= 40),
  status text not null default 'pending' check (status in ('pending', 'contacted', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.account_requests enable row level security;
revoke all on public.account_requests from public, anon, authenticated;
grant all on public.account_requests to service_role;
create unique index if not exists account_requests_pending_email_idx on public.account_requests (lower(email)) where status = 'pending';
create index if not exists account_requests_created_at_idx on public.account_requests (created_at desc);

create table if not exists private.api_rate_limits (
  bucket_key text primary key,
  request_count integer not null check (request_count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);
revoke all on private.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
  current_reset timestamptz;
begin
  if p_key is null or length(p_key) > 300 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit parameters';
  end if;
  insert into private.api_rate_limits(bucket_key, request_count, reset_at, updated_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds), now())
  on conflict (bucket_key) do update set
    request_count = case when private.api_rate_limits.reset_at <= now() then 1 else private.api_rate_limits.request_count + 1 end,
    reset_at = case when private.api_rate_limits.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else private.api_rate_limits.reset_at end,
    updated_at = now()
  returning request_count, reset_at into current_count, current_reset;
  return query select current_count <= p_limit, greatest(1, ceil(extract(epoch from current_reset - now()))::integer);
end;
$$;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

alter table public.quote_logs add column if not exists status text not null default 'draft';
alter table public.quote_logs drop constraint if exists quote_logs_status_check;
alter table public.quote_logs add constraint quote_logs_status_check check (status in ('draft', 'submitted', 'approval_required', 'approved', 'dispatched', 'completed', 'cancelled'));
alter table public.quote_logs drop constraint if exists quote_logs_quote_range_check;
alter table public.quote_logs add constraint quote_logs_quote_range_check check (min_quote is null or max_quote is null or max_quote >= min_quote);
alter table public.quote_logs drop constraint if exists quote_logs_client_source_check;
alter table public.quote_logs add constraint quote_logs_client_source_check check ((quote_source = 'client_portal' and client_id is not null) or (quote_source <> 'client_portal' and client_id is null));

create index if not exists profiles_client_id_idx on public.profiles(client_id);
create index if not exists quote_logs_client_id_idx on public.quote_logs(client_id);
create index if not exists company_invites_client_id_idx on public.company_invites(client_id);
create index if not exists company_invites_invited_by_idx on public.company_invites(invited_by);

drop policy if exists "members can view their company" on public.companies;
drop policy if exists "users can view their own profile" on public.profiles;
drop policy if exists "managers can view company profiles" on public.profiles;
drop policy if exists "managers can manage company profiles" on public.profiles;
drop policy if exists "Managers can view company app_config" on public.app_config;
drop policy if exists "Managers can insert company app_config" on public.app_config;
drop policy if exists "Managers can update company app_config" on public.app_config;
drop policy if exists "company members can view company config" on public.app_config;
drop policy if exists "managers can manage company config" on public.app_config;
drop policy if exists "managers can manage company clients" on public.clients;
drop policy if exists "members can read available equipment" on public.equipment_specs;
drop policy if exists "managers can manage company equipment" on public.equipment_specs;
drop policy if exists "managers and dispatch can read company quote logs" on public.quote_logs;

revoke all on public.companies, public.profiles, public.app_config, public.clients, public.equipment_specs, public.quote_logs, public.company_invites from anon;
grant select on public.companies, public.profiles, public.app_config, public.clients, public.equipment_specs, public.quote_logs to authenticated;
grant insert, update, delete on public.clients to authenticated;
grant update on public.profiles to authenticated;
grant update (bol_path, bol_name, bol_type) on public.quote_logs to authenticated;
