create table public.saved_equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  equipment_key text not null,
  make text not null check (length(trim(make)) between 1 and 80),
  model text not null check (length(trim(model)) between 1 and 80),
  serial_number text check (length(serial_number) <= 100),
  operating_weight_lbs numeric not null check (operating_weight_lbs > 0 and operating_weight_lbs <= 2000000),
  width_in numeric not null check (width_in > 0 and width_in <= 2000),
  height_in numeric not null check (height_in > 0 and height_in <= 2000),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_equipment_scope_identity unique nulls not distinct (company_id, client_id, equipment_key)
);
create index saved_equipment_client_idx on public.saved_equipment (client_id);
create index saved_equipment_updated_by_idx on public.saved_equipment (updated_by);
alter table public.saved_equipment enable row level security;
-- Server-only access. API derives scope from the authenticated profile.
revoke all on public.saved_equipment from public, anon, authenticated;
grant select, insert, update, delete on public.saved_equipment to service_role;
