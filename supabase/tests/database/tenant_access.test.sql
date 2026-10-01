begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.companies(id, name) values
 ('10000000-0000-0000-0000-000000000001', 'Test company A'),
 ('10000000-0000-0000-0000-000000000002', 'Test company B');
insert into auth.users(id, email) values
 ('20000000-0000-0000-0000-000000000001', 'manager-a@example.test'),
 ('20000000-0000-0000-0000-000000000002', 'manager-b@example.test'),
 ('20000000-0000-0000-0000-000000000003', 'client-a@example.test');
insert into public.profiles(id, company_id, email, role) values
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'manager-a@example.test', 'manager'),
 ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'manager-b@example.test', 'manager'),
 ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'client-a@example.test', 'client');
insert into public.clients(id,company_id,client_name) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Client A');
update public.profiles set client_id='30000000-0000-0000-0000-000000000001' where id='20000000-0000-0000-0000-000000000003';
insert into public.app_config(company_id) values('10000000-0000-0000-0000-000000000001');
insert into public.quote_logs(company_id,user_id,pickup_address,dropoff_address,customer_name,created_at)
select '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
 'Pickup','Dropoff', case when n=1 then 'Historical needle' else 'Recent quote' end,
 now() - make_interval(secs => 1100-n)
from generate_series(1,1100) n;
insert into public.quote_logs(company_id,user_id,pickup_address,dropoff_address,customer_name)
values ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Pickup','Dropoff','Other company needle');

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
select is((select count(*) from public.companies), 1::bigint, 'Company A cannot read company B');
select is((select count(*) from public.profiles), 2::bigint, 'Manager can read their company profiles');
select is((select count(*) from public.quote_logs), 1100::bigint, 'Quotes are company scoped');
select is((select count(*) from public.search_quotes('needle',0)), 1::bigint, 'Search finds an old quote beyond the newest 1000 without crossing companies');
select is((select count(*) from public.search_quotes('Recent',0)), 21::bigint, 'Search returns one lookahead row');
select is((select count(*) from public.search_quotes('%',0)), 0::bigint, 'Search treats wildcard characters literally');
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000003';
select is((select count(*) from public.profiles), 1::bigint, 'Client sees only own profile');
select is((select count(*) from public.app_config), 0::bigint, 'Client cannot read internal pricing configuration');
select is((select count(*) from public.quote_logs), 0::bigint, 'Client cannot read staff quotes');
select is((select count(*) from public.search_quotes('needle',0)), 0::bigint, 'Search preserves client scope');
select is((select count(*) from public.clients), 1::bigint, 'Client can read their own account');
reset role;
select ok(not has_function_privilege('anon','public.update_my_default_base(text)','EXECUTE'), 'Anonymous users cannot execute privileged profile helper');
select ok(not has_table_privilege('authenticated','public.equipment_specs','SELECT'), 'Equipment cache remains server only');
select * from finish();
rollback;
