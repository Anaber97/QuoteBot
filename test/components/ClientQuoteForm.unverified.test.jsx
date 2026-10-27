import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const searchEquipmentSpecs = vi.fn();
const saveEquipmentSpecs = vi.fn();

vi.mock('../../src/services/equipmentSpecs.js', () => ({
  searchEquipmentSpecs, saveEquipmentSpecs,
  googleSpecsUrl: (make, model, query) => 'https://www.google.com/search?q='+encodeURIComponent([make,model].filter(Boolean).join(' ') || query),
  calculatePermitRequirements: vi.fn(() => ({ flags: [], permitFee: 0 })),
}));
vi.mock('../../src/lib/googleMaps.js', () => ({
  loadGoogleMaps: vi.fn(() => new Promise(() => {})),
}));

const { default: ClientQuoteForm } = await import('../../src/components/ClientQuoteForm.jsx');
const { calculatePermitRequirements } = await import('../../src/services/equipmentSpecs.js');

test('permit figures are visible only in the regular equipment calculator', async () => {
  calculatePermitRequirements.mockReturnValue({ needsPermit: true, flags: ['Oversize Width'], permitFee: 150 });
  const user = userEvent.setup();
  const props = { companyRates: {}, onCalculate: vi.fn() };
  const { rerender } = render(<ClientQuoteForm {...props} />);
  await user.type(screen.getByLabelText('Width (in)'), '120');
  expect(screen.queryByText(/Estimated Permit Surcharge/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Transport Permit Requirements Detected/)).not.toBeInTheDocument();
  rerender(<ClientQuoteForm {...props} isDispatcherView />);
  expect(screen.getByText(/Estimated Permit Surcharge: \+\$150.00/)).toBeInTheDocument();
  calculatePermitRequirements.mockReturnValue({ flags: [], permitFee: 0 });
});

describe('ClientQuoteForm unverified equipment', () => {
  test('does not show a permit warning before state-specific route evaluation', () => {
    render(<ClientQuoteForm companyRates={{ client_portal: { osow_pricing: { enabled: true } } }} onCalculate={vi.fn()} isCalculating={false} />);

    expect(screen.queryByText(/transport permit requirements detected/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/state-specific osow flags and pricing/i)).not.toBeInTheDocument();
  });

  test('warns before filling unverified equipment specs', async () => {
    searchEquipmentSpecs.mockResolvedValue({
      results: [{
        id: 'equipment-1',
        make: 'Caterpillar',
        model: '320',
        operating_weight_lbs: 54450,
        width_in: 118,
        height_in: 120,
        verification_status: 'Unverified',
      }],
      source: 'ai-gateway',
      error: '',
    });
    const user = userEvent.setup();

    render(<ClientQuoteForm companyRates={{}} onCalculate={vi.fn()} isCalculating={false} />);
    await user.type(screen.getByLabelText(/equipment search/i), 'Caterpillar 320');
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    await user.click(await screen.findByRole('button', { name: /caterpillar 320/i }));

    expect(screen.getByRole('dialog', { name: /LOW confidence: use these specs/i })).toBeInTheDocument();
    expect(screen.getByText(/may result in an incorrect quote/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/operating weight/i)).toHaveValue(null);

    await user.click(screen.getByRole('button', { name: /use these specs/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/operating weight/i)).toHaveValue(54450);
    expect(screen.getByLabelText(/width/i)).toHaveValue(118);
    expect(screen.getByLabelText(/height/i)).toHaveValue(120);
    expect(screen.getByLabelText(/serial number/i)).toHaveValue('');
  });
});

for (const confidence of ['HIGH', 'MEDIUM']) {
 test(confidence+' fills specifications without a LOW warning',async()=>{
  searchEquipmentSpecs.mockResolvedValue({results:[{id:'result',make:'CAT',model:'320',confidence,operating_weight_lbs:45000,width_in:102,height_in:138}],source:'web'});
  const user=userEvent.setup();render(<ClientQuoteForm companyRates={{}} onCalculate={vi.fn()}/>);
  await user.type(screen.getByLabelText(/equipment search/i),'CAT 320');await user.click(screen.getByRole('button',{name:/^search$/i}));
  await user.click(await screen.findByRole('button',{name:/CAT 320/i}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByLabelText(/operating weight/i)).toHaveValue(45000);
 });
}

test('failed search offers a Google link using the original query', async () => {
 searchEquipmentSpecs.mockResolvedValue({ results: [], error: 'No match', source: '' });
 const user=userEvent.setup();render(<ClientQuoteForm companyRates={{}} onCalculate={vi.fn()}/>);
 await user.type(screen.getByLabelText(/equipment search/i),'Tico Prospotter');
 await user.click(screen.getByRole('button',{name:/^search$/i}));
 const link=await screen.findByRole('link',{name:/look up specs on google/i});
 expect(link).toHaveAttribute('target','_blank');expect(link.getAttribute('href')).toContain('Tico%20Prospotter');
});
test('manual save requires complete specs, submits entered values, and reports private scope', async () => {
 saveEquipmentSpecs.mockResolvedValue({scope:'client'});
 const user=userEvent.setup();render(<ClientQuoteForm companyRates={{}} onCalculate={vi.fn()}/>);
 expect(screen.getByRole('button',{name:/save to my equipment/i})).toBeDisabled();
 await user.type(screen.getByLabelText('Make',{exact:true}),'Tico');await user.type(screen.getByLabelText('Model',{exact:true}),'Prospotter');
 await user.type(screen.getByLabelText(/operating weight/i),'15000');await user.type(screen.getByLabelText(/width/i),'96');await user.type(screen.getByLabelText(/height/i),'120');
 await user.click(screen.getByRole('button',{name:/save to my equipment/i}));
 expect(saveEquipmentSpecs).toHaveBeenLastCalledWith({make:'Tico',model:'Prospotter',serial_number:'',operating_weight_lbs:15000,width_in:96,height_in:120});
 expect(await screen.findByRole('status')).toHaveTextContent('Saved to your client account equipment');
});

test('a quote needs weight, width, and height before it is calculated', async () => {
  const onCalculate = vi.fn();
  const user = userEvent.setup();
  render(<ClientQuoteForm companyRates={{}} onCalculate={onCalculate} isCalculating={false} />);
  await user.type(screen.getByLabelText('Width (in)'), '96');
  await user.click(screen.getByRole('button', { name: /calculate quote/i }));
  expect(screen.getByText('Enter the operating weight, width, and height to get a quote.')).toHaveAttribute('role', 'alert');
  expect(screen.getByLabelText('Operating Weight (lbs)')).toHaveFocus();
  expect(onCalculate).not.toHaveBeenCalled();
});

test('the permit estimate uses the client weight classes and counts the attachment', async () => {
  const tiers = [{ minWeight: 0, maxWeight: 999999, rate: 200, permitCost: 275 }];
  const user = userEvent.setup();
  render(<ClientQuoteForm companyRates={{}} onCalculate={vi.fn()} client={{ pricing: { use_custom_pricing: true, weight_tiers: tiers } }} />);
  await user.type(screen.getByLabelText('Operating Weight (lbs)'), '40000');
  await user.type(screen.getByLabelText(/attachment weight/i), '6000');
  expect(calculatePermitRequirements).toHaveBeenLastCalledWith(expect.objectContaining({ weight: 46000, tiers }));
});
