import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const express = require('express');
const { startServer, productPage, productData } = require('../helpers/server');

const vin = (n) => ({ domaine: `Domaine ${n}`, cuvee: `Cuvée ${n}`, prix: `${n} €`, link: `/vin/${n}`, image: `/img/${n}.jpg` });

describe('scraperRoutes', () => {
  let shop;
  let back;
  let api;
  let backResponse;

  const post = async (path, body) => {
    const res = await fetch(`${api.url}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  beforeAll(async () => {
    shop = await startServer({
      '/vins': productPage([vin(1), vin(2)]),
      '/limited': { status: 429, body: 'slow' },
    });
    back = await startServer({
      '/ws/boutiques/La%20Cave%20%26%20Co/import': () => backResponse,
    });

    // WS_BACK_BASE_URL est lu au chargement du module
    process.env.WS_BACK_BASE_URL = back.url;
    const scraperRoutes = require('../../app/scraperRoutes');

    const app = express();
    app.use(express.json());
    scraperRoutes(app);
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    api = { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
  });

  afterAll(async () => {
    await api.close();
    await shop.close();
    await back.close();
  });

  beforeEach(() => {
    backResponse = { body: { result: { logs: ['import ok'], Insérées: 2, Filtrées: 0 } } };
    back.requests.length = 0;
  });

  describe('POST /scrape', () => {
    it('retourne les lignes brutes', async () => {
      const { status, body } = await post('/scrape', { id: 1, scrapeData: { url: `${shop.url}/vins`, data: productData } });
      expect(status).toBe(200);
      expect(body.map((r) => r.cuvee)).toEqual(['Cuvée 1', 'Cuvée 2']);
    });

    it('renvoie 500 et le message si la config est invalide', async () => {
      const { status, body } = await post('/scrape', { id: 1, scrapeData: {} });
      expect(status).toBe(500);
      expect(body.error).toMatch(/url et data sont requis/);
    });
  });

  describe('POST /run', () => {
    const meta = { nom_boutique: 'La Cave & Co', id_boutique: 7 };
    const body = () => ({ id: 7, scrapeData: { url: `${shop.url}/vins`, data: productData }, meta });

    it('envoie les lignes nettoyées au backend, sur l’URL encodée de la boutique', async () => {
      const { status } = await post('/run', body());
      expect(status).toBe(200);
      expect(back.requests).toHaveLength(1);
      const sent = JSON.parse(back.requests[0].body);
      expect(sent.meta).toEqual(meta);
      expect(sent.rows).toEqual([
        { domaine: 'Domaine 1', cuvee: 'Cuvée 1', prix: '1', link: '/vin/1', image: '/img/1.jpg' },
        { domaine: 'Domaine 2', cuvee: 'Cuvée 2', prix: '2', link: '/vin/2', image: '/img/2.jpg' },
      ]);
    });

    it('retourne le résumé et ajoute les compteurs du backend à la ligne « Total de lignes »', async () => {
      const { body: res } = await post('/run', body());
      expect(res.status).toBe('success');
      expect(res.data).toEqual(meta);
      expect(res.summary).toMatchObject({ rawRows: 2, dedupedRows: 2 });
      expect(res.runLines).toContain('✅ La Cave & Co 📈 Total de lignes : 2,"Insérées":2,"Filtrées":0');
      expect(res.dbImportLines).toEqual(['import ok']);
      expect(res.dbImport).toEqual(backResponse.body);
    });

    it('accepte les compteurs en anglais (inserted/filtered)', async () => {
      backResponse = { body: { result: { inserted: 5, filtered: 1 } } };
      const { body: res } = await post('/run', body());
      expect(res.runLines.at(-1)).toBe('✅ La Cave & Co 📈 Total de lignes : 2,"Insérées":5,"Filtrées":1');
      expect(res.dbImportLines).toEqual([]);
    });

    it('laisse la ligne intacte si le backend ne renvoie pas de compteurs', async () => {
      backResponse = { body: { ok: true } };
      const { body: res } = await post('/run', body());
      expect(res.runLines.at(-1)).toBe('✅ La Cave & Co 📈 Total de lignes : 2');
    });

    it('renvoie 500 si l’import backend échoue', async () => {
      backResponse = { status: 500, body: { error: 'db down' } };
      const { status, body: res } = await post('/run', body());
      expect(status).toBe(500);
      expect(res.error).toMatch(/500/);
    });

    it('renvoie 429 quand le site cible limite les requêtes', async () => {
      const { status, body: res } = await post('/run', { ...body(), scrapeData: { url: `${shop.url}/limited`, data: productData } });
      expect(status).toBe(429);
      expect(res.error).toMatch(/HTTP 429/);
      expect(back.requests).toHaveLength(0);
    });
  });
});
