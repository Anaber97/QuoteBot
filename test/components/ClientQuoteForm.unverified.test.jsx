import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const searchEquipmentSpecs = vi.fn();

vi.mock('../../src/services/equipmentSpecs.js', () => ({
  searchEquipmentSpecs,
  calculatePermitRequirements: vi.fn(() => ({ flags: [], permitFee: 0 })),
}));
vi.mock('../../src/lib/googleMaps.js', () => ({
  loadGoogleMaps: vi.fn(() => new Promise(() => {})),
}));

const { default: ClientQuoteForm } = await import('../../src/components/ClientQuoteForm.jsx');

describe('ClientQuoteForm unverified equipment', () => {
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

    expect(screen.getByRole('dialog', { name: /use unverified equipment specs/i })).toBeInTheDocument();
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
