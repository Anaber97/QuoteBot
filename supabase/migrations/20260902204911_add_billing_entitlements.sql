-- Provider-neutral billing state. Checkout and webhook code can be added later
-- without making the browser a source of truth for paid access.
create table public.company_subscriptions (
  company_id uuid primary key references public.companies(id) on delete cascade,
  plan_code text not null default 'core' check (plan_code in ('core', 'business', 'enterprise')),
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'comped')),
  billing_interval text check (billing_interval in ('month', 'year')),
  provider text check (provider in ('stripe')),
  provider_customer_id text unique,
  provider_subscription_id text unique,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (provider is null and provider_customer_id is null and provider_subscription_id is null)
    or provider is not null
  )
);

create index company_subscriptions_status_idx
  on public.company_subscriptions (status);

alter table public.company_subscriptions enable row level security;

-- Subscription state is readable by members of its company, but is only
-- mutated by trusted server-side billing code (service_role bypasses RLS).
create policy "Company members can read subscription state"
  on public.company_subscriptions
  for select
  to authenticated
  using (company_id = (select company_id from private.current_profile()));

revoke all on table public.company_subscriptions from anon, authenticated;
grant select on table public.company_subscriptions to authenticated;
grant all on table public.company_subscriptions to service_role;

comment on table public.company_subscriptions is
  'Server-managed subscription state used to resolve company entitlements.';
comment on column public.company_subscriptions.metadata is
  'Non-authoritative provider context. Never store secrets or card data here.';
