begin;
do $$
declare
  company uuid;
  client uuid;
  row_count integer;
begin
  insert into public.companies(name) values ('Equipment transaction test') returning id into company;
  insert into public.clients(company_id, client_name) values (company, 'Equipment test client') returning id into client;
  insert into public.saved_equipment(company_id, client_id, equipment_key, make, model, operating_weight_lbs, width_in, height_in)
  values (company, null, 'test', 'Test', 'Machine', 1000, 80, 90);
  insert into public.saved_equipment(company_id, client_id, equipment_key, make, model, operating_weight_lbs, width_in, height_in)
  values (company, null, 'test', 'Test', 'Machine', 1100, 80, 90)
  on conflict (company_id, client_id, equipment_key) do update set operating_weight_lbs=excluded.operating_weight_lbs;
  select count(*) into row_count from public.saved_equipment where company_id=company and client_id is null;
  if row_count <> 1 then raise exception 'Company save did not deduplicate'; end if;
  insert into public.saved_equipment(company_id, client_id, equipment_key, make, model, operating_weight_lbs, width_in, height_in)
  values (company, client, 'test', 'Test', 'Machine', 1200, 80, 90);
  select count(*) into row_count from public.saved_equipment where company_id=company;
  if row_count <> 2 then raise exception 'Client save collided with company equipment'; end if;
  if (select operating_weight_lbs from public.saved_equipment where company_id=company and client_id is null) <> 1100 then
    raise exception 'Client save changed company specs';
  end if;
end $$;
rollback;
