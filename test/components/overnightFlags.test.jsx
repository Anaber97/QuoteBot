import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuoteSaveForm from '../../src/features/quotes/QuoteSaveForm.jsx';

const state = { quoteData: { approvalRequired: false }, customerName: '', customerPhone: '' };

test('the save form shows the review notice when overnights make a quote need approval', () => {
  const { rerender } = render(<QuoteSaveForm state={state} isDispatcherView />);
  expect(screen.queryByText(/requires manager review/)).not.toBeInTheDocument();
  rerender(<QuoteSaveForm state={state} isDispatcherView approvalRequired />);
  expect(screen.getByText(/requires manager review/)).toBeInTheDocument();
  rerender(<QuoteSaveForm state={{ ...state, quoteData: { approvalRequired: true } }} isDispatcherView />);
  expect(screen.getByText(/requires manager review/)).toBeInTheDocument();
});
