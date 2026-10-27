import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
import PricingTab from '../../src/components/Settings/PricingTab.jsx';

test('OSOW settings expose units, preserve zero prices and update deck height',()=>{
 const updateClientPortal=vi.fn(), updateClientPortalTier=vi.fn();
 render(<PricingTab formData={{pricing:{},client_portal:{weight_tiers:[{minWeight:0,maxWeight:80000,rate:100}],osow_pricing:{enabled:false}}}} customSurchargeSearch="" customSurchargeFilter="all" customSurchargeItems={[]} updateClientPortal={updateClientPortal} updateClientPortalTier={updateClientPortalTier} />);
 fireEvent.click(screen.getByLabelText('Use state-specific OSOW rules'));
 expect(updateClientPortal).toHaveBeenCalledWith('osow_pricing',expect.objectContaining({enabled:true}));
 fireEvent.change(screen.getByLabelText('2 Escorts ($ / trip)'),{target:{value:'0'}});
 expect(updateClientPortal).toHaveBeenCalledWith('osow_pricing',expect.objectContaining({twoEscort:0}));
 fireEvent.change(screen.getByLabelText('Average Clearance (deck height, in.) class 1'),{target:{value:'48'}});
 expect(updateClientPortalTier).toHaveBeenCalledWith(0,'averageClearanceIn',48);
});

test('escort pricing sets a per-mile rate and minimum per escort, blank by default',()=>{
 const updateClientPortal=vi.fn();
 render(<PricingTab formData={{pricing:{},client_portal:{weight_tiers:[],osow_pricing:{enabled:false},escort_pricing:{perMile:2.5,minimum:null}}}} customSurchargeSearch="" customSurchargeFilter="all" customSurchargeItems={[]} updateClientPortal={updateClientPortal} updateClientPortalTier={vi.fn()} />);
 expect(screen.getByLabelText('Rate per escort ($ / mile)')).toHaveValue(2.5);
 expect(screen.getByLabelText('Minimum per escort ($)')).toHaveValue(null);
 fireEvent.change(screen.getByLabelText('Minimum per escort ($)'),{target:{value:'350'}});
 expect(updateClientPortal).toHaveBeenCalledWith('escort_pricing',{perMile:2.5,minimum:350});
 fireEvent.change(screen.getByLabelText('Rate per escort ($ / mile)'),{target:{value:''}});
 expect(updateClientPortal).toHaveBeenCalledWith('escort_pricing',{perMile:null,minimum:null});
});

test('overnight settings show the federal hour limits and blank charges',()=>{
 const updateClientPortal=vi.fn();
 const overnight={maxDriveHours:11,maxOnDutyHours:14,permittedLoadHours:null,driverCharge:null,escortCharge:null};
 render(<PricingTab formData={{pricing:{},client_portal:{weight_tiers:[],osow_pricing:{enabled:false},overnight_pricing:overnight}}} customSurchargeSearch="" customSurchargeFilter="all" customSurchargeItems={[]} updateClientPortal={updateClientPortal} updateClientPortalTier={vi.fn()} />);
 expect(screen.getByLabelText('Max driving hours / day')).toHaveValue(11);
 expect(screen.getByLabelText('Max on-duty hours / day')).toHaveValue(14);
 expect(screen.getByLabelText('Permitted-load travel hours / day')).toHaveValue(null);
 fireEvent.change(screen.getByLabelText('Overnight charge per driver ($ / night)'),{target:{value:'275'}});
 expect(updateClientPortal).toHaveBeenCalledWith('overnight_pricing',{...overnight,driverCharge:275});
});
