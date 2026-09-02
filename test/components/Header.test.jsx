import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

const { default: Header } = await import('../../src/components/Header.jsx');

describe('Header account controls', () => {
  test('keeps sign out available when an authenticated user has no profile', async () => {
    const onSignOut = vi.fn();
    render(
      <Header
        session={{ user: { email: 'stranded@example.com' } }}
        profile={null}
        activeTab="calculator"
        setActiveTab={vi.fn()}
        onSignOut={onSignOut}
        onToggleTheme={vi.fn()}
      />,
    );

    expect(screen.getByText('stranded@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
