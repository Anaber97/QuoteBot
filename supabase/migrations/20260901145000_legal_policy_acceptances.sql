-- Versioned policy acceptance. A new policy version has no matching row, so
-- applications can require renewed acknowledgment after material changes.
create table if not exists public.policy_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null check (length(trim(terms_version)) between 1 and 80),
  privacy_version text not null check (length(trim(privacy_version)) between 1 and 80),
  accepted_at timestamptz not null default now(),
  unique (user_id, terms_version, privacy_version)
);

alter table public.policy_acceptances enable row level security;
revoke all on public.policy_acceptances from public, anon, authenticated;
grant select on public.policy_acceptances to authenticated;
grant all on public.policy_acceptances to service_role;

create policy "Users can read their policy acceptances" on public.policy_acceptances
for select to authenticated using ((select auth.uid()) = user_id);

drop function if exists public.accept_company_invite(text, uuid, text);
create function public.accept_company_invite(
  p_token text,
  p_user_id uuid,
  p_full_name text,
  p_terms_version text,
  p_privacy_version text
)
returns table(company_id uuid, role text, email text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invite public.company_invites%rowtype;
  v_auth_email text;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then raise exception 'Authenticated user does not match requested user'; end if;
  if p_token is null or length(trim(p_token)) < 20 then raise exception 'Invalid invitation token'; end if;
  if p_terms_version is null or length(trim(p_terms_version)) < 1 or p_privacy_version is null or length(trim(p_privacy_version)) < 1 then
    raise exception 'Current policy acknowledgment is required';
  end if;
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
  if exists (select 1 from public.profiles p where p.id = p_user_id and (p.company_id <> v_invite.company_id or p.role <> v_invite.role)) then raise exception 'User already belongs to another workspace'; end if;
  insert into public.profiles (id, company_id, client_id, email, full_name, role)
  values (p_user_id, v_invite.company_id, v_invite.client_id, v_auth_email, coalesce(nullif(trim(p_full_name), ''), coalesce(v_invite.full_name, '')), v_invite.role)
  on conflict (id) do update set email = excluded.email, client_id = excluded.client_id, full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end;
  insert into public.policy_acceptances (user_id, terms_version, privacy_version)
  values (p_user_id, trim(p_terms_version), trim(p_privacy_version)) on conflict do nothing;
  update public.company_invites set status = 'accepted', accepted_at = now(), accepted_by = p_user_id where id = v_invite.id;
  return query select v_invite.company_id, v_invite.role, v_auth_email;
end;
$function$;

revoke all on function public.accept_company_invite(text, uuid, text, text, text) from public, anon;
grant execute on function public.accept_company_invite(text, uuid, text, text, text) to authenticated;
