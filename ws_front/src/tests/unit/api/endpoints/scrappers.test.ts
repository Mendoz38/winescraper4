import { describe, expect, it, vi } from 'vitest';
import {
  createScrapper,
  deleteScrapper,
  fetchScrapper,
  fetchScrappers,
  updateScrapper,
} from '../../../../api/endpoints/scrappers';
import type { Scrapper } from '../../../../api/endpoints/scrappers';

describe('API scrappers endpoints', () => {
  it('fetchScrappers retourne result', async () => {
    const payload = [{ id: 'a' }] as unknown as Scrapper[];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: payload }),
    } as Response);

    await expect(fetchScrappers()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/ws\/scrappers$/));
  });

  it('fetchScrappers retourne [] sans result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await expect(fetchScrappers()).resolves.toEqual([]);
  });

  it('fetchScrapper lance une erreur HTTP', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchScrapper('42')).rejects.toThrow('Erreur 500');
  });

  it('updateScrapper envoie un PUT JSON', async () => {
    const payload = { id: 'x', a_scraper: true, active: true } as Scrapper;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: payload }),
    } as Response);

    await expect(updateScrapper('x', payload)).resolves.toEqual(payload);

    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/ws\/scrappers\/x$/), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  });

  it('createScrapper envoie un POST JSON', async () => {
    const payload = { id: 'new-id' } as Scrapper;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: payload }),
    } as Response);

    await expect(createScrapper({ id: 'new-id' })).resolves.toEqual(payload);

    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/ws\/scrappers\/add$/), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'new-id' }),
    });
  });

  it('deleteScrapper envoie un DELETE', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    await expect(deleteScrapper('99')).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/ws\/scrappers\/99$/), {
      method: 'DELETE',
    });
  });
});
