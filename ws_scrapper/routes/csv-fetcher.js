const { parse } = require('csv-parse/sync');
const { fetchHtml } = require('./html-fetcher');

/**
 * Parse un texte CSV et mappe les colonnes vers les champs BASE_FIELDS
 * attendus en aval (domaine, cuvee, prix, stock, image, link),
 * par INDEX de colonne (0-based), comme l'ancien système PHP.
 *
 * @param {string} text - Contenu brut du CSV
 * @param {{ separator?: string, columns: Record<string, number|string|null> }} opts
 *   columns: { domaine: 2, cuvee: 0, prix: 3, image: 4, link: 1, stock: null }
 * @returns {Array<Record<string,string>>}
 */
const parseCsvText = (text, { separator = ';', columns = {} } = {}) => {
  const records = parse(text, {
    delimiter: separator,
    columns: false, // tableaux de valeurs, pas d'objets -> mapping par index
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
    from_line: 2, // saute la ligne d'en-tête (remplace le hack DELETE ttc='price')
  });

  return records.map((record) => {
    const row = {};
    for (const field of ['domaine', 'cuvee', 'prix', 'stock', 'image', 'link']) {
      const idx = columns[field];
      row[field] = idx !== null && idx !== undefined && idx !== '' ? (record[Number(idx)] ?? '') : '';
    }
    return row;
  });
};

/**
 * Télécharge un CSV et retourne les lignes mappées.
 * @param {string} url
 * @param {{ separator?: string, columns: Record<string, number|string|null> }} csvSource
 */
const fetchCsvRows = async (url, csvSource = {}) => {
  const text = await fetchHtml(url, {}); // mode simple (axios), jamais puppeteer pour un CSV
  return parseCsvText(text, csvSource);
};

module.exports = { fetchCsvRows, parseCsvText };
