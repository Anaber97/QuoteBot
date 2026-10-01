alter table public.equipment_specs enable row level security;
drop policy if exists equipment_select_shared_or_company on public.equipment_specs;
revoke all on public.equipment_specs from anon, authenticated;
