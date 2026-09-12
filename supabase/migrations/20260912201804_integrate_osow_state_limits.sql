-- Existing OSOW lookup, included here so clean installations can reproduce it.
CREATE TABLE IF NOT EXISTS public.state_transport_limits (
 state_code text PRIMARY KEY, state_name text NOT NULL,
 legal_height_in numeric NOT NULL, legal_width_in numeric NOT NULL, legal_weight_lbs numeric NOT NULL,
 one_escort_height_in numeric, one_escort_width_in numeric,
 two_escort_height_in numeric, two_escort_width_in numeric,
 notes text, source_url text, retrieved_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.state_transport_limits ENABLE ROW LEVEL SECURITY;
-- Reference data is read through the authenticated server endpoint. No public write policy.
COMMENT ON TABLE public.state_transport_limits IS 'OSOW screening thresholds imported from OSOW Data sep26.xlsx. Notes and null thresholds require review; not a complete permit or route-clearance ruleset.';

-- Company pricing is already JSONB. Add nullable vehicle assumptions without
-- changing existing prices, custom client rates, or enabling new charges.
UPDATE public.app_config AS c SET client_portal =
 jsonb_set(
   jsonb_set(coalesce(c.client_portal, '{}'::jsonb), '{osow_pricing}',
      '{"enabled":false,"generalPermit":null,"oneEscort":null,"twoEscort":null}'::jsonb || coalesce(c.client_portal->'osow_pricing','{}'::jsonb)),
   '{weight_tiers}',
   coalesce((select jsonb_agg('{"averageClearanceIn":null,"averageVehicleWeightLbs":null}'::jsonb || tier order by ord)
     from jsonb_array_elements(coalesce(c.client_portal->'weight_tiers','[]'::jsonb)) with ordinality as t(tier,ord)), '[]'::jsonb)
 );

-- Preserve the US baseline. Import by state_code; blank updated_at uses now().
INSERT INTO public.state_transport_limits (state_code,state_name,legal_height_in,legal_width_in,legal_weight_lbs,one_escort_height_in,one_escort_width_in,two_escort_height_in,two_escort_width_in,notes,source_url,retrieved_at) VALUES
('AL','ALABAMA',162,102,80000,186,144,NULL,168,NULL,'https://wcspermits.com/alabama-oversize-permits/','2026-09-11T17:56:51Z'),
('AK','ALASKA',180,102,80000,204,126,NULL,144,NULL,'https://dot.alaska.gov/mscvc/assets/webdocs/permits_manual.pdf','2026-09-11T17:56:51Z'),
('AZ','ARIZONA',168,102,80000,192,132,204,168,'2 escort height trigger is really special routing','https://azdot.gov/mvd/services/enforcement/commercial-vehicle-permits/general-permit-information/oversizeoverweight','2026-09-11T17:56:51Z'),
('AR','ARKANSAS',168,102,80000,180,144,204,168,'2 escort height trigger is really special routing','https://media.ark.org/ardot/2023-Permit-Rules.pdf','2026-09-11T17:56:51Z'),
('CA','CALIFORNIA',168,102,80000,216,144,NULL,168,NULL,'https://wcspermits.com/california-oversize-permits/','2026-09-11T17:56:51Z'),
('CO','COLORADO',174,102,80000,192,156,210,180,'2 escort height trigger is really special routing','https://www.sos.state.co.us/CCR/GenerateRulePdf.do?ruleVersionId=8635&fileName=2%20CCR%20601-4','2026-09-11T17:56:51Z'),
('CT','CONNECTICUT',162,102,80000,168,144,183,162,'2nd height trigger requires police escort','https://wcspermits.com/connecticut-oversize-permits/','2026-09-11T17:56:51Z'),
('DE','DELAWARE',162,102,80000,NULL,156,180,168,'jumps straight to 2 escorts for height','https://regulations.delaware.gov/AdminCode/title2/2405','2026-09-11T17:56:51Z'),
('FL','FLORIDA',162,102,80000,174,144,192,168,'2nd height trigger is replaced by police escort','https://www.flhsmv.gov/florida-highway-patrol/commercial-vehicle-enforcement/safety-enforcement/size-and-permit-enforcement/','2026-09-11T17:56:51Z'),
('GA','GEORGIA',162,102,80000,186,144,NULL,176,NULL,'https://rules.sos.ga.gov/gac/672-2','2026-09-11T17:56:51Z'),
('HI','HAWAII',168,102,80000,193,145,NULL,169,NULL,'https://wcspermits.com/hawaii-oversize-load-permits/','2026-09-11T17:56:51Z'),
('ID','IDAHO',162,102,80000,204,168,NULL,174,NULL,'https://wcspermits.com/idaho-oversize-permits/','2026-09-11T17:56:51Z'),
('IL','ILLINOIS',162,102,80000,174,148,180,172,'2nd height trigger is replaced by bucket truck','https://wcspermits.com/illinois-oversize-permits/','2026-09-11T17:56:51Z'),
('IN','INDIANA',162,102,80000,174,148,NULL,172,'over 200,000 GVW = 2 escorts','https://www.in.gov/dor/motor-carrier-services/oversizeoverweight-osw/','2026-09-11T17:56:51Z'),
('IA','IOWA',162,102,80000,174,144,NULL,174,NULL,'https://iowadot.gov/motor-carriers/how-do-i-get-oversize-overweight-permits/permit-requirements','2026-09-11T17:56:51Z'),
('KS','KANSAS',168,102,80000,204,NULL,NULL,168,'jumps straight to 2 escorts for width','https://wcspermits.com/kansas-oversize-permits/','2026-09-11T17:56:51Z'),
('KY','KENTUCKY',162,102,80000,179,144,NULL,168,'more restrictive 2-escort flag of 2','https://drive.ky.gov/Motor-Carriers/Overweight-Over-Dimensional/Pages/OWOD-Legal-Dimensions.aspx','2026-09-11T17:56:51Z'),
('LA','LOUISIANA',168,102,80000,190,144,200,192,'2nd height trigger is replaced by utility line lifting, 2nd width trigger is replaced by police escort','https://wcspermits.com/hauling-oversize-loads-in-louisiana/','2026-09-11T17:56:51Z'),
('ME','MAINE',162,102,80000,NULL,144,NULL,NULL,NULL,'https://www.maine.gov/sos/bmv/vehicles/commercial-vehicles-motor-carrier-services/overlimit-permits','2026-09-11T17:56:51Z'),
('MD','MARYLAND',162,102,80000,174,156,NULL,168,NULL,'https://roads.maryland.gov/mdotsha/pages/index.aspx?PageId=500','2026-09-11T17:56:51Z'),
('MA','MASSACHUSETTS',162,102,80000,164,144,167,162,NULL,'https://www.mass.gov/info-details/commercial-truck-permits-height-and-weight-limitations','2026-09-11T17:56:51Z'),
('MI','MICHIGAN',162,102,80000,173,144,180,168,NULL,'https://www.michigan.gov/mdot/-/media/Project/Websites/MDOT/Business/Truckers/Rules-and-Guidelines/Moving-Oversize-Overweight-Vehicles-Loads.pdf?rev=d4573b180ff34eeb98583d0c1f0e7a2c&hash=1CA13909DD3DAA3397DC97C8BC0990F8','2026-09-11T17:56:51Z'),
('MN','MINNESOTA',162,102,80000,174,150,192,174,'2nd height trigger is ambiguous','https://www.dot.state.mn.us/cvo/oversize/determine.html','2026-09-11T17:56:51Z'),
('MS','MISSISSIPPI',162,102,80000,168,155,NULL,192,NULL,'https://mdot.ms.gov/portal/over-dimensional_permits','2026-09-11T17:56:51Z'),
('MO','MISSOURI',162,102,80000,186,144,NULL,192,NULL,'https://www.modot.org/sites/default/files/documents/LegalSizeAndWeight_3.pdf','2026-09-11T17:56:51Z'),
('MT','MONTANA',168,102,80000,204,198,NULL,216,NULL,'https://www.mdt.mt.gov/other/webdata/external/mcs/MT-PERMIT-RESTRICTIONS-New.PDF','2026-09-11T17:56:51Z'),
('NE','NEBRASKA',168,102,80000,174,144,NULL,192,NULL,'https://dot.nebraska.gov/media/y1idsekz/legal-sizes-weights.pdf','2026-09-11T17:56:51Z'),
('NV','NEVADA',168,102,80000,186,144,NULL,168,NULL,'https://www.dot.nv.gov/doing-business/commercial-vehicles/commercial-vehicle-permits','2026-09-11T17:56:51Z'),
('NH','NEW HAMPSHIRE',162,102,80000,168,144,NULL,168,'2nd width trigger is replaced by police escort','https://wcspermits.com/new-hampshire-oversize-permits/','2026-09-11T17:56:51Z'),
('NJ','NEW JERSEY',162,102,80000,168,168,NULL,192,NULL,'https://wcspermits.com/new-jersey-oversize-permits/','2026-09-11T17:56:51Z'),
('NM','NEW MEXICO',168,102,86400,192,144,NULL,168,NULL,'https://wcspermits.com/new-mexico-oversize-permits/','2026-09-11T17:56:51Z'),
('NY','NEW YORK',162,102,80000,168,144,192,192,'2nd height trigger is replaced by police escort, 2nd width trigger requires 3 pilot cars + police escort','https://www.dot.ny.gov/nypermits/repository/perm71b.pdf','2026-09-11T17:56:51Z'),
('NC','NORTH CAROLINA',168,102,80000,173,144,198,168,'2nd height trigger is replaced by police escort','https://connect.ncdot.gov/business/trucking/pages/overpermits.aspx','2026-09-11T17:56:51Z'),
('ND','NORTH DAKOTA',168,102,80000,216,174,NULL,192,NULL,'https://www.statepatrol.nd.gov/sites/default/files/documents/MC/2026MCPolicies/9-1%20Vehicle%20Legal%20Size%20and%20Weight%20Guide%20Handout3.26-UA.pdf','2026-09-11T17:56:51Z'),
('OH','OHIO',162,102,80000,174,156,178,174,NULL,'https://dam.assets.ohio.gov/image/upload/transportation.ohio.gov/permits/special-hauling/os-1a.pdf','2026-09-11T17:56:51Z'),
('OK','OKLAHOMA',162,102,80000,NULL,144,189,168,'jumps straight to 2 escorts for height','https://oklahoma.gov/odot/about-us/laws-and-rules/size-and-weight-permits.html#accordion-951c933d17-item-ab68742ddd','2026-09-11T17:56:51Z'),
('OR','OREGON',168,102,80000,174,144,NULL,NULL,NULL,'https://www.oregon.gov/odot/MCT/Pages/Legal-Vehicle-Dimensions.aspx','2026-09-11T17:56:51Z'),
('PA','PENNSYLVANIA',162,102,80000,174,156,NULL,174,'2nd width trigger is replaced by police escort','https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/067/chapter179/chap179toc.html','2026-09-11T17:56:51Z'),
('RI','RHODE ISLAND',162,102,80000,168,144,NULL,174,NULL,'https://www.dot.ri.gov/travel/docs/bridge_restrictions/RI_Legal_OSOW_Z-Fold_Guide.pdf','2026-09-11T17:56:51Z'),
('SC','SOUTH CAROLINA',162,102,80000,192,144,NULL,168,NULL,'https://wcspermits.com/south-carolina-oversize-permits/','2026-09-11T17:56:51Z'),
('SD','SOUTH DAKOTA',168,102,80000,180,144,216,192,'2nd trigger for both are ambiguous','https://sdtruckinfo.sd.gov/rules-regulations/motor-carrier-handbook/chapter-5/vehicle-size-regulations/','2026-09-11T17:56:51Z'),
('TN','TENNESSEE',162,102,80000,181,151,NULL,168,NULL,'https://advance.lexis.com/documentpage/?pdmfid=1000516&crid=2c98e77c-ed9e-494c-8bad-2cf9726a7b25&pdistocdocslideraccess=true&config=025054JABlOTJjNmIyNi0wYjI0LTRjZGEtYWE5ZC0zNGFhOWNhMjFlNDgKAFBvZENhdGFsb2cDFQ14bX2GfyBTaI9WcPX5&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A4X8K-SXV0-R03K-72CC-00008-00&pdcomponentid=234180&pdtocnodeidentifier=ACDAAHAABAAD&ecomp=t2vckkk&prid=6c789caa-3e55-4fe6-a4a6-de46879d7345','2026-09-11T17:56:51Z'),
('TX','TEXAS',168,102,80000,204,168,216,192,NULL,'https://www.txdmv.gov/motor-carriers/oversize-overweight-permits/texas-size-weight-limits','2026-09-11T17:56:51Z'),
('UT','UTAH',168,102,80000,192,144,NULL,168,NULL,'https://connect.udot.utah.gov/business/motor-carriers/size-weight-permitting/oversize-overweight-provisions/','2026-09-11T17:56:51Z'),
('VT','VERMONT',162,102,80000,168,144,NULL,180,'1st height and 2nd width triggers are ambiguous','https://dmv.vermont.gov/document/rules-for-overweight-overdimension-permits','2026-09-11T17:56:51Z'),
('VA','VIRGINIA',162,102,80000,173,144,NULL,168,NULL,'https://www.dmv.virginia.gov/businesses/motor-carriers/overload','2026-09-11T17:56:51Z'),
('WA','WASHINGTON',168,102,80000,174,NULL,NULL,132,'jumps straight to 2 escorts for width','https://wsdot.wa.gov/travel/commercial-vehicles/commercial-vehicle-permits/self-issue-permit','2026-09-11T17:56:51Z'),
('WV','WEST VIRGINIA',162,102,80000,180,126,NULL,144,NULL,'https://transportation.wv.gov/legal-size-and-weight-limits','2026-09-11T17:56:51Z'),
('WI','WISCONSIN',162,102,80000,180,150,NULL,192,NULL,'https://wisconsindot.gov/Pages/dmv/com-drv-vehs/mtr-car-trkr/osow-permit-req.aspx','2026-09-11T17:56:51Z'),
('WY','WYOMING',168,102,80000,204,NULL,NULL,168,'jumps straight to 2 escorts for width','https://whp.wyo.gov/commercial-carrier','2026-09-11T17:56:51Z')
ON CONFLICT (state_code) DO UPDATE SET state_name=EXCLUDED.state_name,legal_height_in=EXCLUDED.legal_height_in,legal_width_in=EXCLUDED.legal_width_in,legal_weight_lbs=EXCLUDED.legal_weight_lbs,one_escort_height_in=EXCLUDED.one_escort_height_in,one_escort_width_in=EXCLUDED.one_escort_width_in,two_escort_height_in=EXCLUDED.two_escort_height_in,two_escort_width_in=EXCLUDED.two_escort_width_in,notes=EXCLUDED.notes,source_url=EXCLUDED.source_url,retrieved_at=EXCLUDED.retrieved_at,updated_at=now();
