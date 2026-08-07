-- Supabase SQL: create and secure the clients table.
-- Assumes public.profiles.id matches auth.uid() and profiles.company_id stores workspace ownership.

create extension if not exists pgcrypto;

alter table public.app_config
  add column if not exists client_portal jsonb not null default '{}'::jsonb;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  client_name text not null,
  contact_email text,
  contact_phone text,
  approval_threshold integer,
  pricing jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients
  add column if not exists company_id uuid,
  add column if not exists client_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists approval_threshold integer,
  add column if not exists pricing jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_clients_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_clients_updated_at();

create index if not exists clients_company_id_idx
  on public.clients (company_id);

alter table public.clients enable row level security;

drop policy if exists "Select own company clients" on public.clients;
drop policy if exists "Insert own company clients" on public.clients;
drop policy if exists "Update own company clients" on public.clients;
drop policy if exists "Delete own company clients" on public.clients;

create policy "Select own company clients"
  on public.clients
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = company_id
    )
  );

create policy "Insert own company clients"
  on public.clients
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = company_id
    )
  );

create policy "Update own company clients"
  on public.clients
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = company_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = company_id
    )
  );

create policy "Delete own company clients"
  on public.clients
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = company_id
    )
  );
