const { scrape } = require('../routes/scraper');
const { epur } = require('../routes/text-utils');
const { FIELD_POLLUTIONS } = require('./field-pollutions');

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 600_000;

const BASE_FIELDS = ['domaine', 'cuvee', 'prix', 'stock', 'image', 'link'];

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout après ${ms}ms`)), ms))]);

const isTimeoutError = (err) => String(err?.message ?? '').startsWith('Timeout après');

const scrapeWithRetry = async (config, maxAttempts, timeoutMs) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log('[run] scrape:attempt', attempt, '/', maxAttempts);
      return await withTimeout(scrape(config), timeoutMs);
    } catch (err) {
      lastError = err;
      console.log('[run] scrape:failed attempt=', attempt, 'error=', err?.message ?? String(err));
      if (isTimeoutError(err)) break;
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  throw lastError;
};

/**
 * Nettoie les pollutions textuelles d'une valeur selon sa colonne,
 * puis applique `epur`.
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
const cleanRow = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([k, v]) => {
      if (v == null || typeof v !== 'string') return [k, v ?? ''];
      const tokens = FIELD_POLLUTIONS[k] ?? [];
      const cleaned = tokens.reduce(
        (s, token) => (typeof token === 'string' ? s.replaceAll(token, '') : s.replaceAll(token.from, token.to)),
        v
      );
      return [k, epur(cleaned) ?? ''];
    })
  );

/**
 * Log un avertissement pour chaque colonne entièrement vide.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} id
 */
const warnEmptyFields = (rows, id) => {
  BASE_FIELDS.forEach((field) => {
    const empty = rows.filter((r) => !String(r[field] ?? '').trim()).length;
    if (empty === rows.length) console.warn('[run] ⚠️', field, 'vide à 100% | id=', id);
  });
};

/**
 * Lance le scraping, nettoie les lignes et retourne le résultat prêt pour la BDD.
 * @param {{ id: string, scrapeData: object, meta?: Record<string, unknown> }} params
 * @returns {Promise<{ rows: Array<Record<string, unknown>>, summary: { rawRows: number, dedupedRows: number, duplicates: number, durationMs: number } }>}
 */
const executeScrape = async ({ id, scrapeData, meta = {} }) => {
  const t0 = Date.now();
  const maxAttempts = Number(scrapeData.max_attempts || DEFAULT_MAX_ATTEMPTS);
  const timeoutMs = Number(scrapeData.timeout_ms || DEFAULT_TIMEOUT_MS);

  const rawRows = await scrapeWithRetry(scrapeData, maxAttempts, timeoutMs);
  const cleanedRows = rawRows.map(cleanRow);

  warnEmptyFields(cleanedRows, id);

  console.log('[run] ✅', meta.nom_boutique || id, '📈 Total de lignes :', cleanedRows.length);

  return {
    rows: cleanedRows,
    summary: {
      rawRows: rawRows.length,
      dedupedRows: cleanedRows.length,
      duplicates: 0,
      durationMs: Date.now() - t0,
    },
  };
};

module.exports = { executeScrape };
