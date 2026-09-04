alter table public.equipment_specs
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists verification_status text not null default 'Unverified',
  add column if not exists sources jsonb not null default '[]'::jsonb,
  add column if not exists configuration text,
  add column if not exists weight_type text not null default 'operating',
  add column if not exists retrieved_at timestamptz;

alter table public.equipment_specs drop constraint if exists equipment_specs_verification_status_check;
alter table public.equipment_specs add constraint equipment_specs_verification_status_check
  check (verification_status in ('Verified', 'Corroborated', 'Unverified', 'Conflict'));

create index if not exists equipment_specs_company_make_model_idx
  on public.equipment_specs (company_id, lower(make), lower(model));
