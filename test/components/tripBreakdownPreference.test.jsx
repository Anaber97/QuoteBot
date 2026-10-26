import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  localStorage.clear();
  vi.resetModules();
});

it('opens the trip breakdown by default', async () => {
  const { initialState } = await import('../../src/features/quotes/calculatorState');
  expect(initialState.showDetails).toBe(true);
});

it('remembers the last choice, including across a cleared form', async () => {
  const { appReducer, initialState } = await import('../../src/features/quotes/calculatorState');
  const closed = appReducer(initialState, { type: 'TOGGLE_DETAILS' });
  expect(closed.showDetails).toBe(false);
  expect(localStorage.getItem('towcalc_trip_breakdown')).toBe('closed');
  expect(appReducer(closed, { type: 'RESET_FORM' }).showDetails).toBe(false);

  vi.resetModules();
  const reloaded = await import('../../src/features/quotes/calculatorState');
  expect(reloaded.initialState.showDetails).toBe(false);
  expect(appReducer(closed, { type: 'TOGGLE_DETAILS' }).showDetails).toBe(true);
  expect(localStorage.getItem('towcalc_trip_breakdown')).toBe('open');
});
