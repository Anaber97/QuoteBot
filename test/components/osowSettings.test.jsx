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
