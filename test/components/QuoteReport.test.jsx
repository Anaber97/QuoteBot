import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuoteReport from '../../src/components/QuoteReport.jsx';

test('requires a reason, sends it, and confirms success', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<QuoteReport onSubmit={onSubmit} />);
  await user.click(screen.getByRole('button', { name: 'Report this quote' }));
  expect(screen.getByRole('button', { name: 'Submit report' })).toBeDisabled();
  await user.type(screen.getByLabelText('What’s wrong with this quote?'), '  Price looks wrong  ');
  await user.click(screen.getByRole('button', { name: 'Submit report' }));
  expect(onSubmit).toHaveBeenCalledWith('Price looks wrong');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Report sent');
});

test('retains the reason and shows a send failure for retry', async () => {
  const user = userEvent.setup();
  render(<QuoteReport onSubmit={vi.fn().mockRejectedValue(new Error('Email unavailable'))} />);
  await user.click(screen.getByRole('button', { name: 'Report this quote' }));
  await user.type(screen.getByLabelText('What’s wrong with this quote?'), 'Wrong equipment');
  await user.click(screen.getByRole('button', { name: 'Submit report' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Email unavailable');
  expect(screen.getByLabelText('What’s wrong with this quote?')).toHaveValue('Wrong equipment');
});
