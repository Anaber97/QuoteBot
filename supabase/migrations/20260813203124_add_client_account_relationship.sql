-- Client users belong to one client account within their company workspace.
alter table public.profiles
  add column if not exists client_id uuid references public.clients(id) on delete set null;

alter table public.company_invites
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists profiles_company_client_idx
  on public.profiles (company_id, client_id);

create or replace function public.accept_company_invite(p_token text, p_user_id uuid, p_full_name text)
returns table(company_id uuid, role text, email text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_invite public.company_invites%rowtype;
  v_auth_email text;
begin
  if p_token is null or length(trim(p_token)) < 20 then
    raise exception 'Invalid invitation token';
  end if;

  select lower(u.email) into v_auth_email from auth.users u where u.id = p_user_id;
  if v_auth_email is null then raise exception 'Auth user not found'; end if;

  select * into v_invite from public.company_invites
  where token = trim(p_token) and status = 'pending' for update;
  if not found then raise exception 'Invitation is no longer valid'; end if;

  if v_invite.expires_at <= now() then
    update public.company_invites set status = 'expired' where id = v_invite.id;
    raise exception 'Invitation has expired';
  end if;
  if lower(v_invite.email) <> v_auth_email then
    raise exception 'Invitation email does not match authenticated user';
  end if;
  if v_invite.client_id is not null and v_invite.role <> 'client' then
    raise exception 'Only client users can be assigned to a client account';
  end if;
  if exists (
    select 1 from public.profiles p where p.id = p_user_id
      and (p.company_id <> v_invite.company_id or p.role <> v_invite.role)
  ) then raise exception 'User already belongs to another workspace'; end if;

  insert into public.profiles (id, company_id, client_id, email, full_name, role)
  values (p_user_id, v_invite.company_id, v_invite.client_id, v_auth_email,
    coalesce(nullif(trim(p_full_name), ''), coalesce(v_invite.full_name, '')), v_invite.role)
  on conflict (id) do update set
    email = excluded.email,
    client_id = excluded.client_id,
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end;

  update public.company_invites
  set status = 'accepted', accepted_at = now(), accepted_by = p_user_id
  where id = v_invite.id;

  return query select v_invite.company_id, v_invite.role, v_auth_email;
end;
$function$;
