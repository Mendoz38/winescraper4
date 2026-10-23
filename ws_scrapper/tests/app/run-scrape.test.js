import { describe, it, expect, afterEach } from 'vitest';

const { executeScrape } = require('../../app/run-scrape');
const { startServer } = require('../helpers/server');

const page = (products) => `<ul>${products
  .map(
    (p) => `<li class="product">
      <span class="domaine">${p.domaine ?? ''}</span>
      <span class="cuvee">${p.cuvee ?? ''}</span>
      <span class="prix">${p.prix ?? ''}</span>
      <span class="stock">${p.stock ?? ''}</span>
      <img src="${p.image ?? ''}">
      <a href="${p.link ?? ''}">voir</a>
    </li>`
  )
  .join('')}</ul>`;

const data = {
  csv: [
    'li.product',
    {
      domaine: '.domaine',
      cuvee: '.cuvee',
      prix: '.prix',
      stock: '.stock',
      image: { selector: 'img', scrape: ['attr', 'src'] },
      link: { selector: 'a', scrape: ['attr', 'href'] },
    },
  ],
};

describe('executeScrape', () => {
  let server;
  afterEach(() => server?.close());

  const run = async (products, { meta, scrapeData = {} } = {}) => {
    server = await startServer({ '/vins': page(products) });
    return executeScrape({ id: '42', scrapeData: { url: `${server.url}/vins`, data, ...scrapeData }, meta });
  };

  describe('nettoyage des champs (FIELD_POLLUTIONS)', () => {
    it('prix : retire libellés et devises', async () => {
      const { rows } = await run([
        { cuvee: 'A', prix: 'Prix 12,50 €' },
        { cuvee: 'B', prix: 'Regular price 9.90 EUR' },
        { cuvee: 'C', prix: '15 CHF TTC' },
      ]);
      expect(rows.map((r) => r.prix)).toEqual(['12,50', '9.90', '15']);
    });

    it('stock : normalise les ruptures et vide les mentions de disponibilité', async () => {
      const { rows } = await run([
        { cuvee: 'A', stock: 'Rupture de stock' },
        { cuvee: 'B', stock: 'Sold out' },
        { cuvee: 'C', stock: 'Épuisé' },
        { cuvee: 'D', stock: 'En stock' },
        { cuvee: 'E', stock: 'Ajouter au panier' },
      ]);
      expect(rows.map((r) => r.stock)).toEqual(['Rupture', 'Rupture', 'Rupture', '', '']);
    });

    it('domaine : applique les substitutions from/to', async () => {
      const { rows } = await run([{ domaine: 'Domaine Nadal', cuvee: 'A' }]);
      expect(rows[0].domaine).toBe('Domaine Naadal');
    });

    it('image : remplace le gabarit {width}', async () => {
      const { rows } = await run([{ cuvee: 'A', image: 'https://cdn.shop.fr/vin_{width}x.jpg' }]);
      expect(rows[0].image).toBe('https://cdn.shop.fr/vin_200x.jpg');
    });

    it('normalise retours ligne et espaces multiples', async () => {
      const { rows } = await run([{ cuvee: 'Cuvée\n   Rouge\t Nature', domaine: '  Le   Clos ' }]);
      expect(rows[0].cuvee).toBe('Cuvée Rouge Nature');
      expect(rows[0].domaine).toBe('Le Clos');
    });

    it('remplace les valeurs nulles par une chaîne vide', async () => {
      const { rows } = await run([{ cuvee: 'A' }]);
      expect(rows[0]).toEqual({ domaine: '', cuvee: 'A', prix: '', stock: '', image: '', link: '' });
    });
  });

  describe('résultat', () => {
    it('retourne le résumé et la ligne de succès avec le nom de la boutique', async () => {
      const { rows, summary, runLines } = await run([{ cuvee: 'A' }, { cuvee: 'B' }], { meta: { nom_boutique: 'La Cave' } });
      expect(rows).toHaveLength(2);
      expect(summary).toMatchObject({ rawRows: 2, dedupedRows: 2, duplicates: 0 });
      expect(summary.durationMs).toBeGreaterThanOrEqual(0);
      expect(runLines.at(-1)).toBe('✅ La Cave 📈 Total de lignes : 2');
    });

    it('utilise l’id quand le nom de boutique est absent', async () => {
      const { runLines } = await run([{ cuvee: 'A' }]);
      expect(runLines.at(-1)).toBe('✅ 42 📈 Total de lignes : 1');
    });

    it('signale chaque colonne vide à 100 %', async () => {
      const { runLines } = await run([
        { cuvee: 'A', prix: '10 €', domaine: 'X', image: '/a.jpg', link: '/a' },
        { cuvee: 'B', prix: '12 €', domaine: 'Y', image: '/b.jpg', link: '/b' },
      ]);
      expect(runLines).toEqual(['[run] ⚠️ stock vide à 100% | id= 42', '✅ 42 📈 Total de lignes : 2']);
    });

    it('échoue si le scraping dépasse timeout_ms', async () => {
      server = await startServer({
        '/lent': () => new Promise((resolve) => setTimeout(() => resolve(page([{ cuvee: 'A' }])), 1000)),
      });
      await expect(executeScrape({ id: '42', scrapeData: { url: `${server.url}/lent`, data, timeout_ms: 100 } })).rejects.toThrow(
        'Timeout après 100ms'
      );
    });
  });
});
