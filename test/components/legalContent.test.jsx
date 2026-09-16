import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Footer from '../../src/components/Footer';
import LegalPage from '../../src/components/LegalPage';
import PolicyAcknowledgment from '../../src/components/PolicyAcknowledgment';
import QuoteResultsCard from '../../src/components/QuoteResultsCard';

describe('legal surfaces', () => {
  it('renders footer links and both legal page structures', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms');
    render(<LegalPage type="privacy" />);
    expect(screen.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeInTheDocument();
  });

  it('shows one disclaimer for client results and none for dispatcher results', () => {
    const { rerender } = render(<QuoteResultsCard state={{ quoteData: { baseMinQuote: 100, baseMaxQuote: 120 }, activeOverrides: {} }} />);
    expect(screen.getByRole('note')).toHaveTextContent(/non-binding estimate/i);
    expect(screen.getByRole('note')).toHaveTextContent(/route.*vehicle.*site access.*permits.*tolls/i);
    expect(screen.getAllByRole('note')).toHaveLength(1);
    rerender(<QuoteResultsCard isDispatcherView state={{ quoteData: { baseMinQuote: 100, baseMaxQuote: 120 }, activeOverrides: {} }} />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('shows OSOW screening only to dispatchers when a permit is needed', () => {
    const osow = {
      needsPermit: true,
      states: [{ state: 'TX' }],
      loadedHeight: 158.8,
      grossWeight: 112640,
      flags: ['TX: Overwidth, Overweight'],
      reviewReasons: [],
    };
    const state = { quoteData: { baseMinQuote: 100, baseMaxQuote: 120, osow }, activeOverrides: {} };
    const { rerender } = render(<QuoteResultsCard state={state} />);
    expect(screen.queryByText(/OSOW estimate/i)).not.toBeInTheDocument();

    rerender(<QuoteResultsCard isDispatcherView state={state} />);
    expect(screen.getByText(/OSOW estimate/i)).toBeInTheDocument();

    rerender(<QuoteResultsCard isDispatcherView state={{ ...state, quoteData: { ...state.quoteData, osow: { ...osow, needsPermit: false } } }} />);
    expect(screen.queryByText(/OSOW estimate/i)).not.toBeInTheDocument();
  });

  it('shows a single dispatcher price and interactive surcharge controls', async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    render(<QuoteResultsCard
      isDispatcherView
      dispatch={dispatch}
      companyRates={{ pricing: { rounding_interval: 1, custom_surcharges: [{ id: 'fuel', name: 'Fuel', feeType: 'flat', value: 25, active: true }] } }}
      state={{
        quoteData: { pricingMode: 'equipment-weight-tier', fixedRate: 100, rawTotalHours: 1, baseMinQuote: 100, baseMaxQuote: 140, appliedCustomSurcharges: { fuel: true } },
        activeOverrides: { customSurcharges: { fuel: true } },
      }}
    />);
    expect(screen.getByText('$125')).toBeInTheDocument();
    expect(screen.queryByText(/\$100\s*[–-]\s*\$140/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No surcharge add-ons applied/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Fuel.*✕/i }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SET_OVERRIDE',
      payload: { key: 'customSurcharges', value: { fuel: false } },
    }));
  });

  it('keeps a matched surcharge available to restore after it is removed', async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    render(<QuoteResultsCard
      isDispatcherView
      dispatch={dispatch}
      companyRates={{ pricing: { rounding_interval: 1, custom_surcharges: [{ id: 'fuel', name: 'Fuel', feeType: 'flat', value: 25, active: true }] } }}
      state={{
        quoteData: { pricingMode: 'equipment-weight-tier', fixedRate: 100, rawTotalHours: 1, baseMinQuote: 100, baseMaxQuote: 100, hasMetroZone: true },
        activeOverrides: { metro: false, customSurcharges: {} },
      }}
    />);

    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fuel/i })).not.toBeInTheDocument();
    const metroRestore = screen.getByRole('button', { name: /Metro.*↻/i });
    expect(metroRestore).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/No surcharge add-ons applied/i)).toBeInTheDocument();
    await user.click(metroRestore);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_OVERRIDE', payload: { key: 'metro', value: true } });
  });

  it('calculates a custom hourly rate without requiring a load-time override', () => {
    render(<QuoteResultsCard
      isDispatcherView
      dispatch={vi.fn()}
      companyRates={{ pricing: { rounding_interval: 1 } }}
      state={{
        quoteData: { pricingMode: 'equipment-weight-tier', pricingRateMode: 'hourly', fixedRate: 100, rawTotalHours: 2, baseMinQuote: 200, baseMaxQuote: 200 },
        activeOverrides: { customSurcharges: {} },
        customRateInput: '150',
        customLoadUnloadMins: '',
      }}
    />);

    expect(screen.getByText('Custom rate estimate: $300')).toBeInTheDocument();
  });

  it('applies custom load and unload time to the displayed hourly quote', () => {
    render(<QuoteResultsCard
      isDispatcherView
      dispatch={vi.fn()}
      companyRates={{ pricing: { rounding_interval: 1 } }}
      state={{
        quoteData: { pricingMode: 'equipment-weight-tier', pricingRateMode: 'hourly', fixedRate: 100, rawTotalHours: 2, loadUnloadTime: 30, baseMinQuote: 200, baseMaxQuote: 200 },
        activeOverrides: { customSurcharges: {} },
        customRateInput: '',
        customLoadUnloadMins: '60',
      }}
    />);

    expect(screen.getByText('$250')).toBeInTheDocument();
  });

  it('shows the drive-time buffer actually used by the quote calculation', () => {
    render(<QuoteResultsCard
      isDispatcherView
      dispatch={vi.fn()}
      companyRates={{ pricing: { drive_time_buffer: 10 } }}
      state={{
        quoteData: { pricingMode: 'hourly', rawTotalHours: 2, baseMinQuote: 200, baseMaxQuote: 200, driveTimeBufferPercent: 22, legsDetails: [{ label: 'Base → Stop', minutes: 60 }] },
        activeOverrides: { customSurcharges: {} },
        showDetails: true,
      }}
    />);

    expect(screen.getByText(/Adjusted Drive Time \(\+22%\)/i)).toBeInTheDocument();
  });

  it('provides a keyboard-operable, labeled, initially unchecked acknowledgment', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PolicyAcknowledgment checked={false} onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox', { name: /I agree to the Terms of Use/i });
    expect(checkbox).not.toBeChecked();
    checkbox.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalled();
  });
});
