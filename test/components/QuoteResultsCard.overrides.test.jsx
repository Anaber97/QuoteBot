import React, { useState } from 'react';
import { expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import QuoteResultsCard from '../../src/components/QuoteResultsCard';

it('updates the headline for each quote override and restores defaults when cleared', () => {
  const rates = { pricing: { hourly_min: 100, hourly_max: 100, rounding_interval: 1 } };
  const quoteData = { rawTotalHours: 1.6, loadUnloadTime: 30, driveTimeBufferPercent: 10 };
  function Harness() {
    const [overrides, setOverrides] = useState({});
    const keys = { SET_CUSTOM_RATE: 'customRateInput', SET_CUSTOM_DRIVE_BUFFER: 'customDriveTimeBufferPercent', SET_CUSTOM_LOAD_UNLOAD: 'customLoadUnloadMins' };
    return <QuoteResultsCard isDispatcherView companyRates={rates}
      state={{ quoteData, showDetails: true, activeOverrides: {}, customerName: '', customerPhone: '', ...overrides }}
      dispatch={({ type, payload }) => setOverrides((current) => ({ ...current, [keys[type]]: payload }))} />;
  }
  render(<Harness />);
  expect(screen.getAllByText('$160').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Hourly Rate'), { target: { value: '200' } });
  expect(screen.getAllByText('$320').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Drive Time Buffer'), { target: { value: '50' } });
  expect(screen.getAllByText('$400').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Load / Unload Time'), { target: { value: '60' } });
  expect(screen.getAllByText('$500').length).toBeGreaterThan(0);
  for (const label of ['Hourly Rate', 'Drive Time Buffer', 'Load / Unload Time']) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
  }
  expect(screen.getAllByText('$160').length).toBeGreaterThan(0);
  expect(rates.pricing.hourly_min).toBe(100);
  expect(quoteData.loadUnloadTime).toBe(30);
  expect(screen.queryByPlaceholderText(/Override hourly rate/)).not.toBeInTheDocument();
});
