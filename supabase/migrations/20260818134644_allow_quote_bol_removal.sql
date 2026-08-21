drop policy if exists quote_bols_delete on storage.objects;
create policy quote_bols_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'quote-bols'
  and exists (
    select 1 from public.quote_logs q
    where q.id::text = (storage.foldername(name))[2]
      and q.company_id = (select company_id from private.current_profile())
      and (
        (select role from private.current_profile()) <> 'client'
        or (q.quote_source = 'client_portal' and q.client_id = (select client_id from private.current_profile()))
      )
  )
);
