-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  company_id uuid NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT ''::text,
  role text NOT NULL CHECK (role = ANY (ARRAY['manager'::text, 'dispatch'::text, 'client'::text])),
  client_id uuid,
  default_base_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.app_config (
  company_id uuid NOT NULL,
  hourly_min numeric NOT NULL DEFAULT 125,
  hourly_max numeric NOT NULL DEFAULT 135,
  rounding_interval numeric NOT NULL DEFAULT 25,
  drive_time_buffer numeric NOT NULL DEFAULT 10,
  load_unload_base_mins numeric NOT NULL DEFAULT 30,
  extra_stop_mins numeric NOT NULL DEFAULT 15,
  after_hours_multiplier numeric NOT NULL DEFAULT 25,
  road_club_multiplier numeric NOT NULL DEFAULT 15,
  metro_multiplier numeric NOT NULL DEFAULT 28.57,
  hazard_multiplier numeric NOT NULL DEFAULT 40,
  pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
  surcharges jsonb NOT NULL DEFAULT '{}'::jsonb,
  geofences jsonb NOT NULL DEFAULT '{}'::jsonb,
  bases jsonb NOT NULL DEFAULT '[]'::jsonb,
  users jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_portal jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_config_pkey PRIMARY KEY (company_id),
  CONSTRAINT app_config_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_name text NOT NULL,
  contact_email text,
  contact_phone text,
  approval_threshold integer CHECK (approval_threshold IS NULL OR approval_threshold >= 0),
  pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.equipment_specs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  make text NOT NULL,
  model text NOT NULL,
  serial_number text,
  operating_weight_lbs numeric CHECK (operating_weight_lbs IS NULL OR operating_weight_lbs >= 0::numeric),
  width_in numeric CHECK (width_in IS NULL OR width_in > 0::numeric),
  height_in numeric CHECK (height_in IS NULL OR height_in > 0::numeric),
  length_in numeric CHECK (length_in IS NULL OR length_in > 0::numeric),
  width_ft numeric CHECK (width_ft IS NULL OR width_ft > 0::numeric),
  height_ft numeric CHECK (height_ft IS NULL OR height_ft > 0::numeric),
  length_ft numeric CHECK (length_ft IS NULL OR length_ft > 0::numeric),
  is_heavy boolean NOT NULL DEFAULT false,
  source text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT equipment_specs_pkey PRIMARY KEY (id),
  CONSTRAINT equipment_specs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.quote_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  customer_name text,
  customer_phone text,
  pickup_address text NOT NULL,
  dropoff_address text NOT NULL,
  all_waypoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  base_yard_id text,
  truck_class text,
  total_miles numeric CHECK (total_miles IS NULL OR total_miles >= 0::numeric),
  total_hours numeric CHECK (total_hours IS NULL OR total_hours >= 0::numeric),
  min_quote numeric CHECK (min_quote IS NULL OR min_quote >= 0::numeric),
  max_quote numeric CHECK (max_quote IS NULL OR max_quote >= 0::numeric),
  custom_quote numeric CHECK (custom_quote IS NULL OR custom_quote >= 0::numeric),
  applied_surcharges jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quote_logs_pkey PRIMARY KEY (id),
  CONSTRAINT quote_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT quote_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.company_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  role text NOT NULL CHECK (role = ANY (ARRAY['manager'::text, 'dispatch'::text, 'client'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text])),
  token text NOT NULL DEFAULT (gen_random_uuid())::text UNIQUE,
  invited_by uuid,
  client_id uuid,
  accepted_by uuid,
  accepted_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_invites_pkey PRIMARY KEY (id),
  CONSTRAINT company_invites_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT company_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id),
  CONSTRAINT company_invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.profiles(id)
);
