import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const query = {
  select: () => query,
  eq: () => query,
  order: () => Promise.resolve({ data: [], error: null }),
};

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: { from: vi.fn(() => query) },
}));
vi.mock('../../src/lib/api.js', () => ({ authenticatedFetch: vi.fn() }));

const { default: Settings } = await import('../../src/components/Settings.jsx');

describe('Settings dirty state', () => {
  test('changing a towing class name enables Save Settings', async () => {
    render(
      <Settings
        currentUserRole="manager"
        profile={{ company_id: 'company-1' }}
        config={{
          company_id: 'company-1',
          pricing: { custom_truck_classes: [{ id: 'heavy', name: 'Heavy Duty', hourlyRate: 200 }] },
        }}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /^saved$/i });
    expect(saveButton).toBeDisabled();

    const nameInput = screen.getByDisplayValue('Heavy Duty');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Heavy Duty XL');

    expect(screen.getByRole('button', { name: /save settings/i })).toBeEnabled();
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });
});
