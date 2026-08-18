drop policy if exists account_requests_explicit_deny on public.account_requests;
create policy account_requests_explicit_deny on public.account_requests for all to anon, authenticated using (false) with check (false);
drop policy if exists company_invites_explicit_deny on public.company_invites;
create policy company_invites_explicit_deny on public.company_invites for all to anon, authenticated using (false) with check (false);

create index if not exists company_invites_accepted_by_idx on public.company_invites(accepted_by);
