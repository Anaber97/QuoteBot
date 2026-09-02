import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DEFAULT_CONFIG } from '../../src/lib/configSchema.js';

// Settings.jsx talks to Supabase directly for company users/clients, and to
// the API via authenticatedFetch for saving. Both are mocked so the test
// exercises only the unsaved-change UI/state behavior.
vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

const authenticatedFetchMock = vi.fn();
vi.mock('../../src/lib/api.js', () => ({
  authenticatedFetch: (...args) => authenticatedFetchMock(...args),
}));

const { default: Settings } = await import('../../src/components/Settings.jsx');

const baseProfile = { id: 'user-1', company_id: 'company-a', role: 'manager' };

describe('Settings unsaved-change behavior', () => {
  beforeEach(() => {
    authenticatedFetchMock.mockReset();
  });

  test('shows no unsaved-changes banner on initial load', () => {
    render(<Settings config={DEFAULT_CONFIG} onSaveConfig={() => {}} currentUserRole="manager" profile={baseProfile} />);
    expect(screen.queryByText(/Unsaved changes/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saved/i })).toBeDisabled();
  });

  test('switching pricing mode marks the form dirty and enables Save', async () => {
    render(<Settings config={DEFAULT_CONFIG} onSaveConfig={() => {}} currentUserRole="manager" profile={baseProfile} />);

    fireEvent.click(screen.getByRole('button', { name: /mileage mode/i }));

    expect(await screen.findByText(/Unsaved changes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save settings/i })).toBeEnabled();
  });

  test('successfully saving clears the unsaved-changes banner', async () => {
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, config: { ...DEFAULT_CONFIG, pricing: { ...DEFAULT_CONFIG.pricing, pricing_mode: 'mileage' } } }),
    });

    render(<Settings config={DEFAULT_CONFIG} onSaveConfig={() => {}} currentUserRole="manager" profile={baseProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /mileage mode/i }));
    await screen.findByText(/Unsaved changes/i);

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => expect(authenticatedFetchMock).toHaveBeenCalledWith('/api/saveAppConfig', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(screen.queryByText(/Unsaved changes/i)).not.toBeInTheDocument());
    expect(await screen.findByText(/saved successfully/i)).toBeInTheDocument();
  });

  test('editing again after a successful save re-enables Save', async () => {
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, config: { ...DEFAULT_CONFIG, pricing: { ...DEFAULT_CONFIG.pricing, pricing_mode: 'mileage' } } }),
    });
    render(<Settings config={DEFAULT_CONFIG} onSaveConfig={() => {}} currentUserRole="manager" profile={baseProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /mileage mode/i }));
    fireEvent.click(await screen.findByRole('button', { name: /save settings/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /saved/i })).toBeDisabled());

    fireEvent.change(screen.getAllByPlaceholderText('Class Name')[0], { target: { value: 'Priority Tow' } });
    expect(await screen.findByRole('button', { name: /save settings/i })).toBeEnabled();
  });

  test('reorders towing classes and marks the form dirty', async () => {
    render(<Settings config={DEFAULT_CONFIG} onSaveConfig={() => {}} currentUserRole="manager" profile={baseProfile} />);
    const firstClass = screen.getAllByPlaceholderText('Class Name')[0];
    expect(firstClass).toHaveValue('Standard Tow / Flatbed');
    fireEvent.click(screen.getByRole('button', { name: /Move Standard Tow \/ Flatbed down/i }));
    expect(screen.getAllByPlaceholderText('Class Name')[1]).toHaveValue('Standard Tow / Flatbed');
    expect(screen.getByRole('button', { name: /save settings/i })).toBeEnabled();
  });

  test('a failed save keeps the unsaved-changes state and surfaces the error', async () => {
    authenticatedFetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Database unavailable' }),
    });

    render(<Settings config={DEFAULT_CONFIG} onSaveConfig={() => {}} currentUserRole="manager" profile={baseProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /mileage mode/i }));
    await screen.findByText(/Unsaved changes/i);

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    expect(await screen.findByText(/Database unavailable/i)).toBeInTheDocument();
    // The change was never persisted; Save should still be enabled so the user can retry.
    expect(screen.getByRole('button', { name: /save settings/i })).toBeEnabled();
  });

  test('a non-manager sees a restricted view instead of editable settings', () => {
    render(<Settings config={DEFAULT_CONFIG} onSaveConfig={() => {}} currentUserRole="dispatch" profile={{ ...baseProfile, role: 'dispatch' }} />);
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mileage mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save settings/i })).not.toBeInTheDocument();
  });
});
