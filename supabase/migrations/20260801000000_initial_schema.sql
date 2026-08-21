-- Reproducible baseline for a blank Supabase project. Later migrations add
-- client-portal, BOL, authoritative-quote, and reliability features.
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(trim(name)) between 2 and 160), created_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id), email text not null, full_name text not null default '',
  role text not null check (role in ('manager','dispatch','client')), default_base_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.app_config (
  company_id uuid primary key references public.companies(id), hourly_min numeric not null default 125, hourly_max numeric not null default 135,
  rounding_interval numeric not null default 25, drive_time_buffer numeric not null default 10, load_unload_base_mins numeric not null default 30,
  extra_stop_mins numeric not null default 15, after_hours_multiplier numeric not null default 25, road_club_multiplier numeric not null default 15,
  metro_multiplier numeric not null default 28.57, hazard_multiplier numeric not null default 40,
  pricing jsonb not null default '{}', surcharges jsonb not null default '{}', geofences jsonb not null default '{}', bases jsonb not null default '[]',
  users jsonb not null default '[]', client_portal jsonb not null default '{}', config jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), client_name text not null,
  contact_email text, contact_phone text, approval_threshold integer check (approval_threshold is null or approval_threshold >= 0),
  pricing jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.equipment_specs (
  id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id), make text not null, model text not null, serial_number text,
  operating_weight_lbs numeric check (operating_weight_lbs is null or operating_weight_lbs >= 0), width_in numeric check (width_in is null or width_in > 0),
  height_in numeric check (height_in is null or height_in > 0), length_in numeric check (length_in is null or length_in > 0),
  width_ft numeric check (width_ft is null or width_ft > 0), height_ft numeric check (height_ft is null or height_ft > 0), length_ft numeric check (length_ft is null or length_ft > 0),
  is_heavy boolean not null default false, source text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.quote_logs (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), user_id uuid not null references public.profiles(id),
  customer_name text, customer_phone text, pickup_address text not null, dropoff_address text not null, all_waypoints jsonb not null default '[]',
  base_yard_id text, truck_class text, total_miles numeric check (total_miles is null or total_miles >= 0), total_hours numeric check (total_hours is null or total_hours >= 0),
  min_quote numeric check (min_quote is null or min_quote >= 0), max_quote numeric check (max_quote is null or max_quote >= 0), custom_quote numeric check (custom_quote is null or custom_quote >= 0),
  applied_surcharges jsonb not null default '{}', notes text, created_at timestamptz not null default now()
);
create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), email text not null, full_name text,
  role text not null check (role in ('manager','dispatch','client')), status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  token text not null unique default gen_random_uuid()::text, invited_by uuid references public.profiles(id), accepted_by uuid references public.profiles(id),
  accepted_at timestamptz, expires_at timestamptz not null default now() + interval '7 days', created_at timestamptz not null default now()
);
