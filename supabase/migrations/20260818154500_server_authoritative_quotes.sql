-- Quotes are created with the service role only after server-side routing and pricing.
-- Browser users may attach or remove a BOL, but cannot forge or rewrite quote totals.
revoke insert on public.quote_logs from authenticated;
drop policy if exists quote_logs_insert_own on public.quote_logs;

revoke update on public.quote_logs from authenticated;
grant update (bol_path, bol_name, bol_type) on public.quote_logs to authenticated;

drop policy if exists quote_logs_update_scope on public.quote_logs;
create policy quote_logs_update_bol_scope on public.quote_logs for update to authenticated
using (
  company_id = (select company_id from private.current_profile())
  and (
    (select role from private.current_profile()) <> 'client'
    or (quote_source = 'client_portal' and client_id = (select client_id from private.current_profile()))
  )
)
with check (
  company_id = (select company_id from private.current_profile())
  and (
    (select role from private.current_profile()) <> 'client'
    or (quote_source = 'client_portal' and client_id = (select client_id from private.current_profile()))
  )
);
