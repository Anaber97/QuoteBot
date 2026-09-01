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

  it('shows the non-binding estimate disclaimer with every result card', () => {
    render(<QuoteResultsCard state={{ quoteData: { baseMinQuote: 100, baseMaxQuote: 120 }, activeOverrides: {} }} />);
    expect(screen.getByRole('note')).toHaveTextContent(/non-binding estimate/i);
    expect(screen.getByRole('note')).toHaveTextContent(/route.*vehicle.*site access.*permits.*tolls/i);
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
