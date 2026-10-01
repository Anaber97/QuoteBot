import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import Dialog from '../../src/components/Dialog';

test('dialog traps keyboard focus, closes on Escape, and restores focus', async () => {
  const user = userEvent.setup();
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  trigger.focus();
  const onClose = vi.fn();
  const { rerender, unmount } = render(<Dialog open title="Confirm change" onClose={onClose} onConfirm={() => {}}>Details</Dialog>);
  expect(screen.getByRole('dialog', { name: 'Confirm change' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledOnce();
  rerender(<Dialog open={false} title="Confirm change" onClose={onClose} />);
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).not.toBe('hidden');
  unmount();
  trigger.remove();
});
