create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_profile()
returns table(company_id uuid, client_id uuid, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id, p.client_id, p.role
  from public.profiles p
  where p.id = (select auth.uid())
$$;

revoke all on function private.current_profile() from public, anon;
grant execute on function private.current_profile() to authenticated;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.app_config enable row level security;
alter table public.clients enable row level security;
alter table public.equipment_specs enable row level security;
alter table public.quote_logs enable row level security;
alter table public.company_invites enable row level security;

revoke all on public.companies, public.profiles, public.app_config, public.clients,
  public.equipment_specs, public.quote_logs, public.company_invites from anon;
grant select on public.companies, public.profiles, public.app_config, public.clients,
  public.equipment_specs, public.quote_logs to authenticated;
grant insert on public.quote_logs to authenticated;
grant insert, update, delete on public.clients to authenticated;
grant update on public.profiles to authenticated;

create policy companies_select_company on public.companies for select to authenticated
using (id = (select company_id from private.current_profile()));

create policy profiles_select_company on public.profiles for select to authenticated
using (company_id = (select company_id from private.current_profile()));
create policy profiles_update_manager on public.profiles for update to authenticated
using (company_id = (select company_id from private.current_profile()) and (select role from private.current_profile()) = 'manager')
with check (company_id = (select company_id from private.current_profile()) and (select role from private.current_profile()) = 'manager');

create policy app_config_select_company on public.app_config for select to authenticated
using (company_id = (select company_id from private.current_profile()));

create policy clients_select_company_scope on public.clients for select to authenticated
using (
  company_id = (select company_id from private.current_profile())
  and (
    (select role from private.current_profile()) <> 'client'
    or id = (select client_id from private.current_profile())
  )
);
create policy clients_insert_manager on public.clients for insert to authenticated
with check (company_id = (select company_id from private.current_profile()) and (select role from private.current_profile()) = 'manager');
create policy clients_update_manager on public.clients for update to authenticated
using (company_id = (select company_id from private.current_profile()) and (select role from private.current_profile()) = 'manager')
with check (company_id = (select company_id from private.current_profile()) and (select role from private.current_profile()) = 'manager');
create policy clients_delete_manager on public.clients for delete to authenticated
using (company_id = (select company_id from private.current_profile()) and (select role from private.current_profile()) = 'manager');

create policy equipment_select_shared_or_company on public.equipment_specs for select to authenticated
using (company_id is null or company_id = (select company_id from private.current_profile()));

create policy quote_logs_select_scope on public.quote_logs for select to authenticated
using (
  company_id = (select company_id from private.current_profile())
  and ((select role from private.current_profile()) <> 'client' or user_id = (select auth.uid()))
);
create policy quote_logs_insert_own on public.quote_logs for insert to authenticated
with check (company_id = (select company_id from private.current_profile()) and user_id = (select auth.uid()));

create or replace function public.accept_company_invite(p_token text, p_user_id uuid, p_full_name text)
returns table(company_id uuid, role text, email text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invite public.company_invites%rowtype;
  v_auth_email text;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Authenticated user does not match requested user';
  end if;
  if p_token is null or length(trim(p_token)) < 20 then raise exception 'Invalid invitation token'; end if;
  select lower(u.email) into v_auth_email from auth.users u where u.id = (select auth.uid());
  if v_auth_email is null then raise exception 'Auth user not found'; end if;
  select * into v_invite from public.company_invites where token = trim(p_token) and status = 'pending' for update;
  if not found then raise exception 'Invitation is no longer valid'; end if;
  if v_invite.expires_at <= now() then
    update public.company_invites set status = 'expired' where id = v_invite.id;
    raise exception 'Invitation has expired';
  end if;
  if lower(v_invite.email) <> v_auth_email then raise exception 'Invitation email does not match authenticated user'; end if;
  if v_invite.client_id is not null and v_invite.role <> 'client' then raise exception 'Only client users can be assigned to a client account'; end if;
  if exists (select 1 from public.profiles p where p.id = p_user_id and (p.company_id <> v_invite.company_id or p.role <> v_invite.role)) then
    raise exception 'User already belongs to another workspace';
  end if;
  insert into public.profiles (id, company_id, client_id, email, full_name, role)
  values (p_user_id, v_invite.company_id, v_invite.client_id, v_auth_email,
    coalesce(nullif(trim(p_full_name), ''), coalesce(v_invite.full_name, '')), v_invite.role)
  on conflict (id) do update set email = excluded.email, client_id = excluded.client_id,
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end;
  update public.company_invites set status = 'accepted', accepted_at = now(), accepted_by = p_user_id where id = v_invite.id;
  return query select v_invite.company_id, v_invite.role, v_auth_email;
end;
$function$;

revoke all on function public.accept_company_invite(text, uuid, text) from public, anon;
grant execute on function public.accept_company_invite(text, uuid, text) to authenticated;
