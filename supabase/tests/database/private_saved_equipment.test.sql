begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into public.companies(id, name) values
 ('40000000-0000-0000-0000-000000000001', 'Equipment transaction test');
insert into public.clients(id, company_id, client_name) values
 ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Equipment test client');

insert into public.saved_equipment(company_id, client_id, equipment_key, make, model, operating_weight_lbs, width_in, height_in)
values ('40000000-0000-0000-0000-000000000001', null, 'test', 'Test', 'Machine', 1000, 80, 90);
insert into public.saved_equipment(company_id, client_id, equipment_key, make, model, operating_weight_lbs, width_in, height_in)
values ('40000000-0000-0000-0000-000000000001', null, 'test', 'Test', 'Machine', 1100, 80, 90)
on conflict (company_id, client_id, equipment_key) do update set operating_weight_lbs=excluded.operating_weight_lbs;
select is(
 (select count(*) from public.saved_equipment where company_id='40000000-0000-0000-0000-000000000001' and client_id is null),
 1::bigint, 'Company save deduplicates');

insert into public.saved_equipment(company_id, client_id, equipment_key, make, model, operating_weight_lbs, width_in, height_in)
values ('40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'test', 'Test', 'Machine', 1200, 80, 90);
select is(
 (select count(*) from public.saved_equipment where company_id='40000000-0000-0000-0000-000000000001'),
 2::bigint, 'Client save does not collide with company equipment');
select is(
 (select operating_weight_lbs from public.saved_equipment where company_id='40000000-0000-0000-0000-000000000001' and client_id is null),
 1100::numeric, 'Client save leaves company specs unchanged');

select * from finish();
rollback;
