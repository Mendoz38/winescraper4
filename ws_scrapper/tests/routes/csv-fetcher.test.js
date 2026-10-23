import { describe, it, expect, afterEach } from 'vitest';

const { parseCsvText, fetchCsvRows } = require('../../routes/csv-fetcher');
const { startServer } = require('../helpers/server');

const CSV = `nom;lien;domaine;prix;image
Cuvée A;https://shop.fr/a;Domaine X;12,50;https://shop.fr/a.jpg
"Cuvée ""B""";https://shop.fr/b;Domaine Y;9;https://shop.fr/b.jpg

`;

const columns = { cuvee: 0, link: 1, domaine: 2, prix: 3, image: 4, stock: null };

describe('parseCsvText', () => {
  it('saute l’en-tête et mappe les colonnes par index', () => {
    expect(parseCsvText(CSV, { columns })).toEqual([
      { domaine: 'Domaine X', cuvee: 'Cuvée A', prix: '12,50', stock: '', image: 'https://shop.fr/a.jpg', link: 'https://shop.fr/a' },
      { domaine: 'Domaine Y', cuvee: 'Cuvée "B"', prix: '9', stock: '', image: 'https://shop.fr/b.jpg', link: 'https://shop.fr/b' },
    ]);
  });

  it('accepte des index sous forme de chaîne et ignore les colonnes vides', () => {
    const rows = parseCsvText(CSV, { columns: { cuvee: '0', prix: '3', stock: '' } });
    expect(rows[0]).toMatchObject({ cuvee: 'Cuvée A', prix: '12,50', stock: '', domaine: '' });
  });

  it('retourne une chaîne vide pour un index hors limites', () => {
    expect(parseCsvText(CSV, { columns: { cuvee: 42 } })[0].cuvee).toBe('');
  });

  it('gère un autre séparateur et supprime les espaces', () => {
    const text = 'a,b\n  Vin 1 , 10 \n';
    expect(parseCsvText(text, { separator: ',', columns: { cuvee: 0, prix: 1 } })).toEqual([
      { domaine: '', cuvee: 'Vin 1', prix: '10', stock: '', image: '', link: '' },
    ]);
  });
});

describe('fetchCsvRows', () => {
  let server;
  afterEach(() => server?.close());

  it('télécharge le CSV en HTTP puis le parse', async () => {
    server = await startServer({ '/export.csv': { body: CSV, headers: { 'content-type': 'text/csv' } } });
    const rows = await fetchCsvRows(`${server.url}/export.csv`, { columns });
    expect(rows).toHaveLength(2);
    expect(rows[1].cuvee).toBe('Cuvée "B"');
  });

  it('propage une erreur HTTP', async () => {
    server = await startServer({});
    await expect(fetchCsvRows(`${server.url}/absent.csv`, { columns })).rejects.toMatchObject({ status: 404 });
  });
});
