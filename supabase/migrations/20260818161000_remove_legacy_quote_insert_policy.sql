-- Remove the original policy name found on the live project. INSERT remains
-- service-role-only because authenticated has no table INSERT privilege.
drop policy if exists "company users can create company quote logs" on public.quote_logs;
