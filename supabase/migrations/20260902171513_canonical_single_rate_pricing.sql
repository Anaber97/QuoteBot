-- Make the single-rate Settings model explicit in Postgres while retaining
-- legacy min/max aliases for older deployed clients.
alter table public.app_config
  add column if not exists pricing_mode text not null default 'hourly',
  add column if not exists hourly_rate numeric not null default 125,
  add column if not exists mileage_rate numeric not null default 5;

update public.app_config
set
  pricing_mode = case
    when pricing ->> 'pricing_mode' in ('hourly', 'mileage') then pricing ->> 'pricing_mode'
    else 'hourly'
  end,
  hourly_rate = coalesce(
    case when jsonb_typeof(pricing -> 'hourly_rate') = 'number' then (pricing ->> 'hourly_rate')::numeric end,
    case when jsonb_typeof(pricing -> 'hourly_min') = 'number' then (pricing ->> 'hourly_min')::numeric end,
    hourly_min,
    125
  ),
  mileage_rate = coalesce(
    case when jsonb_typeof(pricing -> 'mileage_rate') = 'number' then (pricing ->> 'mileage_rate')::numeric end,
    case when jsonb_typeof(pricing -> 'mileage_min') = 'number' then (pricing ->> 'mileage_min')::numeric end,
    5
  );

update public.app_config
set
  hourly_min = hourly_rate,
  hourly_max = hourly_rate,
  pricing = pricing || jsonb_build_object(
    'pricing_mode', pricing_mode,
    'hourly_rate', hourly_rate,
    'mileage_rate', mileage_rate,
    'hourly_min', hourly_rate,
    'hourly_max', hourly_rate,
    'mileage_min', mileage_rate,
    'mileage_max', mileage_rate
  ),
  config = jsonb_set(
    coalesce(config, '{}'::jsonb),
    '{pricing}',
    coalesce(config -> 'pricing', '{}'::jsonb) || jsonb_build_object(
      'pricing_mode', pricing_mode,
      'hourly_rate', hourly_rate,
      'mileage_rate', mileage_rate,
      'hourly_min', hourly_rate,
      'hourly_max', hourly_rate,
      'mileage_min', mileage_rate,
      'mileage_max', mileage_rate
    ),
    true
  );

alter table public.app_config alter column hourly_max set default 125;

alter table public.app_config
  drop constraint if exists app_config_pricing_mode_check,
  drop constraint if exists app_config_single_hourly_rate_check,
  drop constraint if exists app_config_hourly_rate_nonnegative_check,
  drop constraint if exists app_config_mileage_rate_nonnegative_check,
  add constraint app_config_pricing_mode_check check (pricing_mode in ('hourly', 'mileage')),
  add constraint app_config_single_hourly_rate_check check (hourly_min = hourly_rate and hourly_max = hourly_rate),
  add constraint app_config_hourly_rate_nonnegative_check check (hourly_rate >= 0),
  add constraint app_config_mileage_rate_nonnegative_check check (mileage_rate >= 0);

create or replace function public.sync_app_config_pricing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.pricing_mode := case
    when new.pricing ->> 'pricing_mode' in ('hourly', 'mileage') then new.pricing ->> 'pricing_mode'
    when new.pricing_mode in ('hourly', 'mileage') then new.pricing_mode
    else 'hourly'
  end;
  new.hourly_rate := coalesce(
    case when jsonb_typeof(new.pricing -> 'hourly_rate') = 'number' then (new.pricing ->> 'hourly_rate')::numeric end,
    case when jsonb_typeof(new.pricing -> 'hourly_min') = 'number' then (new.pricing ->> 'hourly_min')::numeric end,
    new.hourly_rate,
    125
  );
  new.mileage_rate := coalesce(
    case when jsonb_typeof(new.pricing -> 'mileage_rate') = 'number' then (new.pricing ->> 'mileage_rate')::numeric end,
    case when jsonb_typeof(new.pricing -> 'mileage_min') = 'number' then (new.pricing ->> 'mileage_min')::numeric end,
    new.mileage_rate,
    5
  );
  new.hourly_min := new.hourly_rate;
  new.hourly_max := new.hourly_rate;
  new.pricing := coalesce(new.pricing, '{}'::jsonb) || jsonb_build_object(
    'pricing_mode', new.pricing_mode,
    'hourly_rate', new.hourly_rate,
    'mileage_rate', new.mileage_rate,
    'hourly_min', new.hourly_rate,
    'hourly_max', new.hourly_rate,
    'mileage_min', new.mileage_rate,
    'mileage_max', new.mileage_rate
  );
  new.config := jsonb_set(
    coalesce(new.config, '{}'::jsonb),
    '{pricing}',
    coalesce(new.config -> 'pricing', '{}'::jsonb) || new.pricing,
    true
  );
  return new;
end;
$$;

revoke all on function public.sync_app_config_pricing() from public, anon, authenticated;

drop trigger if exists app_config_sync_pricing on public.app_config;
create trigger app_config_sync_pricing
before insert or update of pricing, pricing_mode, hourly_rate, mileage_rate, hourly_min, hourly_max, config
on public.app_config
for each row execute function public.sync_app_config_pricing();
