import { describe, it, expect, afterEach } from 'vitest';

const { scrape } = require('../../routes/scraper');
const { startServer, productPage, productData } = require('../helpers/server');

const vin = (n, extra = {}) => ({ domaine: `Domaine ${n}`, cuvee: `Cuvée ${n}`, prix: `${n} €`, link: `/vin/${n}`, image: `/img/${n}.jpg`, ...extra });

describe('scrape', () => {
  let server;
  afterEach(() => server?.close());

  describe('validation', () => {
    it('refuse une config sans url ou sans data', async () => {
      await expect(scrape(undefined)).rejects.toThrow('url et data sont requis');
      await expect(scrape({ url: 'http://x' })).rejects.toThrow('url et data sont requis');
      await expect(scrape({ data: productData })).rejects.toThrow('url et data sont requis');
    });
  });

  describe('page unique', () => {
    it('extrait une ligne par produit', async () => {
      server = await startServer({ '/vins': productPage([vin(1), vin(2)]) });
      const rows = await scrape({ url: `${server.url}/vins`, data: productData });
      expect(rows).toEqual([
        { domaine: 'Domaine 1', cuvee: 'Cuvée 1', prix: '1 €', link: '/vin/1', image: '/img/1.jpg' },
        { domaine: 'Domaine 2', cuvee: 'Cuvée 2', prix: '2 €', link: '/vin/2', image: '/img/2.jpg' },
      ]);
    });

    it('ajoute les champs hors liste (niveau page) à chaque ligne', async () => {
      server = await startServer({ '/vins': productPage([vin(1), vin(2)], { title: 'La Cave' }) });
      const rows = await scrape({ url: `${server.url}/vins`, data: { ...productData, boutique: 'h1.shop-title' } });
      expect(rows.map((r) => r.boutique)).toEqual(['La Cave', 'La Cave']);
    });

    it('utilise sel_category comme domaine quand il est vide', async () => {
      server = await startServer({ '/vins': productPage([vin(1), vin(2, { domaine: '' })]) });
      const rows = await scrape({ url: `${server.url}/vins`, data: productData, sel_category: 'Rouges' });
      expect(rows.map((r) => r.domaine)).toEqual(['Domaine 1', 'Rouges']);
    });

    it('data.category (nettoyé) est prioritaire sur sel_category', async () => {
      server = await startServer({ '/vins': productPage([vin(1, { domaine: '' })]) });
      const rows = await scrape({ url: `${server.url}/vins`, data: { ...productData, category: '  Blancs ' }, sel_category: 'Rouges' });
      expect(rows[0].domaine).toBe('Blancs');
    });

    it('retourne [] si la page reste vide après tous les essais', async () => {
      server = await startServer({ '/vide': productPage([]) });
      const rows = await scrape({ url: `${server.url}/vide`, data: productData });
      expect(rows).toEqual([]);
      expect(server.hits['/vide']).toBe(3);
    });

    it('réessaie une page vide puis garde le résultat dès qu’elle contient des produits', async () => {
      server = await startServer({ '/vins': [productPage([]), productPage([vin(1)])] });
      const rows = await scrape({ url: `${server.url}/vins`, data: productData });
      expect(rows).toHaveLength(1);
      expect(server.hits['/vins']).toBe(2);
    });
  });

  describe('retries HTTP', () => {
    it('réessaie après un 429 (Retry-After plafonné) puis réussit', async () => {
      server = await startServer({
        '/vins': [{ status: 429, body: 'slow', headers: { 'retry-after': '120' } }, productPage([vin(1)])],
      });
      const t0 = Date.now();
      const rows = await scrape({ url: `${server.url}/vins`, data: productData });
      expect(rows).toHaveLength(1);
      expect(server.hits['/vins']).toBe(2);
      // 120 s demandés, plafonnés à SCRAPE_RATE_LIMIT_MAX_DELAY_MS (50 ms en test)
      expect(Date.now() - t0).toBeLessThan(5000);
    });

    it('réessaie après une erreur serveur puis réussit', async () => {
      server = await startServer({ '/vins': [{ status: 503, body: 'down' }, productPage([vin(1)])] });
      expect(await scrape({ url: `${server.url}/vins`, data: productData })).toHaveLength(1);
    });

    it('échoue après le nombre maximal de tentatives', async () => {
      server = await startServer({ '/vins': { status: 500, body: 'boom' } });
      await expect(scrape({ url: `${server.url}/vins`, data: productData })).rejects.toThrow(/HTTP 500/);
      expect(server.hits['/vins']).toBe(3);
    });
  });

  describe('plusieurs URLs', () => {
    it('développe un intervalle [01-03] en conservant le zéro initial', async () => {
      server = await startServer({
        '/p?page=01': productPage([vin(1)]),
        '/p?page=02': productPage([vin(2)]),
        '/p?page=03': productPage([vin(3)]),
      });
      const rows = await scrape({ url: `${server.url}/p?page=[01-03]`, data: productData });
      expect(rows.map((r) => r.cuvee)).toEqual(['Cuvée 1', 'Cuvée 2', 'Cuvée 3']);
    });

    it('accepte un intervalle décroissant', async () => {
      server = await startServer({ '/p/2': productPage([vin(2)]), '/p/1': productPage([vin(1)]) });
      const rows = await scrape({ url: `${server.url}/p/[2-1]`, data: productData });
      expect(rows.map((r) => r.cuvee)).toEqual(['Cuvée 2', 'Cuvée 1']);
    });

    it('accepte une liste d’URLs et garde l’ordre malgré la concurrence', async () => {
      const routes = {};
      for (let n = 1; n <= 6; n++) routes[`/cat${n}`] = productPage([vin(n)]);
      server = await startServer(routes);
      const urls = Object.keys(routes).map((p) => `${server.url}${p}`);
      const rows = await scrape({ url: urls, data: productData, scrape_concurrency: 3 });
      expect(rows.map((r) => r.cuvee)).toEqual(['Cuvée 1', 'Cuvée 2', 'Cuvée 3', 'Cuvée 4', 'Cuvée 5', 'Cuvée 6']);
    });

    it('continue malgré une URL vide parmi d’autres', async () => {
      server = await startServer({ '/a': productPage([vin(1)]), '/b': productPage([]), '/c': productPage([vin(3)]) });
      const rows = await scrape({ url: ['/a', '/b', '/c'].map((p) => `${server.url}${p}`), data: productData });
      expect(rows.map((r) => r.cuvee)).toEqual(['Cuvée 1', 'Cuvée 3']);
    });
  });

  describe('pagination', () => {
    it('suit les liens « suivant » relatifs jusqu’à la dernière page', async () => {
      server = await startServer({
        '/vins': productPage([vin(1)], { next: '?page=2' }),
        '/vins?page=2': productPage([vin(2)], { next: '/vins?page=3' }),
        '/vins?page=3': productPage([vin(3)]),
      });
      const rows = await scrape({ url: `${server.url}/vins`, data: productData, pagination: 'a.next' });
      expect(rows.map((r) => r.cuvee)).toEqual(['Cuvée 1', 'Cuvée 2', 'Cuvée 3']);
    });

    it('s’arrête à max_pages', async () => {
      server = await startServer({
        '/vins': productPage([vin(1)], { next: '/vins?page=2' }),
        '/vins?page=2': productPage([vin(2)], { next: '/vins?page=3' }),
        '/vins?page=3': productPage([vin(3)]),
      });
      const rows = await scrape({ url: `${server.url}/vins`, data: productData, pagination: 'a.next', max_pages: 2 });
      expect(rows).toHaveLength(2);
      expect(server.hits['/vins?page=3']).toBeUndefined();
    });

    it('ne boucle pas sur une page déjà visitée', async () => {
      server = await startServer({
        '/vins': productPage([vin(1)], { next: '/vins?page=2' }),
        '/vins?page=2': productPage([vin(2)], { next: '/vins' }),
      });
      const rows = await scrape({ url: `${server.url}/vins`, data: productData, pagination: 'a.next' });
      expect(rows).toHaveLength(2);
      expect(server.hits['/vins']).toBe(1);
    });

    it('s’arrête sur une page sans produits', async () => {
      server = await startServer({
        '/vins': productPage([vin(1)], { next: '/vins?page=2' }),
        '/vins?page=2': productPage([], { next: '/vins?page=3' }),
        '/vins?page=3': productPage([vin(3)]),
      });
      const rows = await scrape({ url: `${server.url}/vins`, data: productData, pagination: 'a.next' });
      expect(rows.map((r) => r.cuvee)).toEqual(['Cuvée 1']);
      expect(server.hits['/vins?page=3']).toBeUndefined();
    });

    it('pagine chaque URL d’un intervalle', async () => {
      server = await startServer({
        '/c1': productPage([vin(1)], { next: '/c1?p=2' }),
        '/c1?p=2': productPage([vin(2)]),
        '/c2': productPage([vin(3)]),
      });
      const rows = await scrape({ url: `${server.url}/c[1-2]`, data: productData, pagination: 'a.next' });
      expect(rows.map((r) => r.cuvee)).toEqual(['Cuvée 1', 'Cuvée 2', 'Cuvée 3']);
    });
  });

  describe('mode csv', () => {
    it('télécharge et fusionne les CSV de chaque URL', async () => {
      server = await startServer({
        '/f1.csv': 'cuvee;prix\nVin A;10\n',
        '/f2.csv': 'cuvee;prix\nVin B;12\nVin C;14\n',
      });
      const rows = await scrape({
        mode: 'csv',
        url: `${server.url}/f[1-2].csv`,
        data: { csvSource: { columns: { cuvee: 0, prix: 1 } } },
      });
      expect(rows.map((r) => [r.cuvee, r.prix])).toEqual([
        ['Vin A', '10'],
        ['Vin B', '12'],
        ['Vin C', '14'],
      ]);
    });
  });
});
