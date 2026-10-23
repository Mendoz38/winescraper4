import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditPage } from '../../../Pages/Edit';
import * as api from '#/api/endpoints/scrappers';
import { message, Modal } from 'antd';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

function renderWithProviders(node: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe('EditPage', () => {
  it('crée un scrapper en mode ajout', async () => {
    vi.spyOn(api, 'createScrapper').mockResolvedValue({ id: 'new-1' } as api.Scrapper);
    vi.spyOn(message, 'success');

    renderWithProviders(<EditPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Créer' })[0]);

    await waitFor(() => {
      expect(api.createScrapper).toHaveBeenCalledTimes(1);
    });

    expect(message.success).toHaveBeenCalledWith('Scraper créé avec succès');
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
  });

  it('charge puis modifie un scrapper en mode édition', async () => {
    vi.spyOn(api, 'fetchScrapper').mockResolvedValue({
      id: '42',
      boutique_id: 12,
      thecat: 'ok',
      niveau: 1,
      scrapper_niveau: 2,
      a_scraper: true,
      active: true,
      hour_cron: '10',
      day_cron: '2',
      mode: 'full',
      pagination: '.next',
      load_more: '.more',
      add_url_image: null,
      add_url: null,
      item_selector: '.item',
      sel_domaine: '.dom',
      sel_cuvee: '.cuv',
      sel_prix: '.prix',
      sel_stock: '.stock',
      sel_image: null,
      sel_link: null,
      sel_category: null,
      nom_boutique: 'Shop 42',
      en_ligne: true,
      payant: false,
      retrait: false,
      last_run: null,
      urls: ['https://shop.example'],
    } satisfies api.Scrapper);

    vi.spyOn(api, 'updateScrapper').mockResolvedValue({ id: '42' } as api.Scrapper);
    vi.spyOn(message, 'success');

    renderWithProviders(<EditPage id="42" />);

    await screen.findByText('Shop 42');

    fireEvent.click(screen.getAllByRole('button', { name: 'Sauvegarder' })[0]);

    await waitFor(() => {
      expect(api.updateScrapper).toHaveBeenCalledTimes(1);
    });

    expect(message.success).toHaveBeenCalledWith('Scraper modifié avec succès');
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
  });

  it('supprime un scrapper après confirmation', async () => {
    vi.spyOn(api, 'fetchScrapper').mockResolvedValue({
      id: '99',
      boutique_id: 1,
      thecat: null,
      niveau: null,
      a_scraper: false,
      active: false,
      hour_cron: null,
      day_cron: null,
      mode: null,
      pagination: null,
      load_more: null,
      add_url_image: null,
      add_url: null,
      item_selector: null,
      sel_domaine: null,
      sel_cuvee: null,
      sel_prix: null,
      sel_stock: null,
      sel_image: null,
      sel_link: null,
      sel_category: null,
      nom_boutique: 'To Delete',
      en_ligne: null,
      payant: null,
      retrait: null,
      last_run: null,
      urls: [],
    } satisfies api.Scrapper);

    vi.spyOn(api, 'deleteScrapper').mockResolvedValue(undefined);
    vi.spyOn(message, 'success');

    const confirmSpy = vi.spyOn(Modal, 'confirm').mockImplementation((config) => {
      void config.onOk?.();
      const modalRef: ReturnType<typeof Modal.confirm> = {
        destroy: () => undefined,
        update: () => undefined,
      };

      return modalRef;
    });

    renderWithProviders(<EditPage id="99" />);

    await screen.findByText('To Delete');

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    await waitFor(() => {
      expect(api.deleteScrapper).toHaveBeenCalledWith('99');
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(message.success).toHaveBeenCalledWith('Scraper supprimé avec succès');
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
  });
});
