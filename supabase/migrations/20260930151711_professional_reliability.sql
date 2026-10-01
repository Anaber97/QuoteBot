-- Search is evaluated before pagination and runs with the caller's RLS policies.
create or replace function public.search_quotes(p_query text, p_page integer default 0)
returns setof public.quote_logs
language sql stable security invoker set search_path = ''
as $$
  select q.* from public.quote_logs q
  where length(trim(p_query)) between 1 and 160
    and strpos(lower(concat_ws(' ', q.id::text,
      coalesce(q.quote_reference, 'Q-' || upper(left(q.id::text, 8))),
      q.customer_name, q.customer_phone, q.quote_details->>'make',
      q.quote_details->>'model', q.quote_details->>'name', q.quote_details->>'equipmentName'
    )), lower(trim(p_query))) > 0
  order by q.created_at desc, q.id desc
  limit 21 offset (greatest(0, least(coalesce(p_page, 0), 500)) * 20);
$$;
revoke all on function public.search_quotes(text, integer) from public, anon;
grant execute on function public.search_quotes(text, integer) to authenticated;

-- This helper existed remotely but was absent from the migration baseline.
create or replace function public.update_my_default_base(new_default_base_id text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  update public.profiles set default_base_id = nullif(trim(new_default_base_id), '')
  where id = (select auth.uid());
  if not found then raise exception 'Profile not found'; end if;
end;
$$;
revoke execute on function public.update_my_default_base(text) from public, anon;
grant execute on function public.update_my_default_base(text) to authenticated;
create index if not exists quote_events_actor_id_idx on public.quote_events(actor_id);
-- The equivalent company/created_at index remains in place.
drop index if exists public.quote_logs_company_created_idx;

alter table public.quote_logs add column if not exists request_id uuid;
alter table public.quote_logs add column if not exists request_hash text;
create unique index if not exists quote_logs_user_request_idx
  on public.quote_logs(user_id, request_id) where request_id is not null;

-- Durable delivery payload freezes attachments/content across ambiguous retries.
-- Only server credentials can access this table.
create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  actor_id uuid not null references auth.users(id),
  company_id uuid not null references public.companies(id),
  quote_id uuid not null references public.quote_logs(id),
  request_hash text not null,
  event_type text not null check(event_type in ('email_sent','dispatch_requested')),
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','sent')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(actor_id, request_id)
);
alter table public.email_deliveries enable row level security;
revoke all on public.email_deliveries from public, anon, authenticated;
grant all on public.email_deliveries to service_role;
create index email_deliveries_company_idx on public.email_deliveries(company_id);
create index email_deliveries_quote_idx on public.email_deliveries(quote_id);

create or replace function public.complete_email_delivery(p_id uuid, p_provider_message_id text)
returns void language plpgsql security invoker set search_path = ''
as $$
declare delivery public.email_deliveries;
begin
  select * into delivery from public.email_deliveries where id = p_id for update;
  if not found then raise exception 'Delivery not found'; end if;
  if delivery.status = 'sent' then return; end if;
  insert into public.quote_events(quote_id,company_id,actor_id,event_type,metadata)
  values(delivery.quote_id,delivery.company_id,delivery.actor_id,delivery.event_type,
    jsonb_build_object('delivery_id',delivery.id,'recipient',delivery.payload->>'to',
      'provider_message_id',p_provider_message_id));
  update public.email_deliveries set status='sent',sent_at=now(),
    provider_message_id=p_provider_message_id, payload='{}'::jsonb where id=p_id;
end;
$$;
revoke all on function public.complete_email_delivery(uuid,text) from public, anon, authenticated;
grant execute on function public.complete_email_delivery(uuid,text) to service_role;

drop policy if exists profiles_select_company on public.profiles;
create policy profiles_select_company on public.profiles for select to authenticated
using (company_id = (select company_id from private.current_profile())
  and ((select role from private.current_profile()) in ('manager','dispatch') or id = (select auth.uid())));
drop policy if exists app_config_select_company on public.app_config;
create policy app_config_select_company on public.app_config for select to authenticated
using (company_id = (select company_id from private.current_profile())
  and (select role from private.current_profile()) in ('manager','dispatch'));
