import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListPage } from '../../../Pages/List';
import * as hook from '#/api/hooks/useScrappers';
import type { Scrapper } from '#/api/endpoints/scrappers';

const navigateMock = vi.fn();
const refreshMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

describe('ListPage', () => {
  it('affiche chargement', () => {
    vi.spyOn(hook, 'useScrappers').mockReturnValue({
      items: [],
      loading: true,
      error: null,
      refresh: refreshMock,
    });

    render(<ListPage />);

    expect(screen.getByText('Chargement…')).toBeTruthy();
  });

  it('affiche erreur', () => {
    vi.spyOn(hook, 'useScrappers').mockReturnValue({
      items: [],
      loading: false,
      error: 'Erreur test',
      refresh: refreshMock,
    });

    render(<ListPage />);

    expect(screen.getByText('Erreur test')).toBeTruthy();
  });

  it('filtre, ouvre vue et lance scrape', async () => {
    vi.spyOn(hook, 'useScrappers').mockReturnValue({
      items: [
        {
          id: '1',
          boutique_id: 11,
          nom_boutique: 'Alpha Wines',
          en_ligne: true,
          payant: false,
          retrait: true,
          thecat: 'ok',
          niveau: 1,
          scrapper_niveau: 1,
          a_scraper: true,
          active: true,
          last_run: null,
        } as Scrapper,
      ],
      loading: false,
      error: null,
      refresh: refreshMock,
    });

    vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: { runLines: ['ok'] } }),
    } as Response);

    render(<ListPage />);

    const search = screen.getByPlaceholderText('Rechercher par nom de boutique...');
    fireEvent.change(search, { target: { value: 'Alpha' } });

    expect(localStorage.getItem('list:boutique-filter')).toBe('Alpha');
    expect(screen.getByText('Alpha Wines')).toBeTruthy();

    fireEvent.click(screen.getByText('Alpha Wines'));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/edit', search: { id: '1' } });

    fireEvent.click(screen.getByTitle('Voir'));
    expect(window.open).toHaveBeenCalledWith(expect.stringMatching(/\/ws\/scrappers\/1\/view$/), '_blank');

    fireEvent.click(screen.getByTitle('Scrape'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/ws\/scrappers\/1\/run$/));
    });

    expect(refreshMock).toHaveBeenCalled();
  });

  it('navigue vers ajout', () => {
    vi.spyOn(hook, 'useScrappers').mockReturnValue({
      items: [],
      loading: false,
      error: null,
      refresh: refreshMock,
    });

    render(<ListPage />);

    fireEvent.click(screen.getByTitle('Ajouter'));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/add' });
  });
});
