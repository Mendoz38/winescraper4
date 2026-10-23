import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Header from '../../../Pages/components/Header';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

describe('Header', () => {
  it('affiche le titre et le lien de navigation', () => {
    render(<Header />);

    expect(screen.getByText('Wine Scrapper')).toBeTruthy();
    expect(screen.getByText('Liste')).toBeTruthy();
    expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/');
  });
});
