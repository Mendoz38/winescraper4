const fs = require('fs');
const path = require('path');
const { scrape } = require('../routes/scraper');
const { epur } = require('../routes/text-utils');
const { FIELD_POLLUTIONS } = require('./field-pollutions');

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 600_000;

// ─── Retry avec backoff linéaire ─────────────────────────────────────────────

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout après ${ms}ms`)), ms))]);

const isTimeoutError = (err) => String(err?.message ?? '').startsWith('Timeout après');

const scrapeWithRetry = async (config, maxAttempts, timeoutMs) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log('[csv] scrape:attempt', attempt, '/', maxAttempts);
      return await withTimeout(scrape(config), timeoutMs);
    } catch (err) {
      lastError = err;
      console.log('[csv] scrape:failed attempt=', attempt, 'error=', err?.message ?? String(err));
      // Le timeout global ne stoppe pas le scrape en cours (Promise.race).
      // On évite donc de relancer d'autres tentatives en parallèle.
      if (isTimeoutError(err)) break;
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastError;
};

// ─── Nettoyage des lignes ─────────────────────────────────────────────────────

/**
 * Nettoie les pollutions textuelles d'une valeur selon sa colonne,
 * puis applique epur(). Les tokens sont définis dans field-pollutions.js.
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

// ─── Colonnes attendues ───────────────────────────────────────────────────────

const BASE_FIELDS = ['domaine', 'cuvee', 'prix', 'stock', 'image', 'link'];

/**
 * Log un avertissement pour chaque colonne entièrement vide.
 * Toujours sur BASE_FIELDS complet — détecte les sélecteurs cassés y compris cuvee.
 */
const warnEmptyFields = (rows, id, fields) => {
  fields.forEach((field) => {
    const empty = rows.filter((r) => !String(r[field] ?? '').trim()).length;
    if (empty === rows.length) console.warn('[csv] ⚠️  ', field, ' vide à 100% | id=', id);
  });
};

/**
 * Retourne les colonnes à écrire dans le CSV.
 * Exclut cuvee si aucune ligne ne la renseigne (champ intentionnellement vide).
 */
const getFields = (rows) => {
  const hasCuvee = rows.some((r) => String(r.cuvee ?? '').trim().length > 0);
  return hasCuvee ? BASE_FIELDS : BASE_FIELDS.filter((f) => f !== 'cuvee');
};

// ─── Export CSV ───────────────────────────────────────────────────────────────

const escapeCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const writeCsv = (filePath, rows, fields) =>
  new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });
    stream.on('error', reject);
    stream.on('finish', resolve);

    if (!rows.length) {
      stream.end('');
      return;
    }

    const cols = fields.length
      ? fields
      : [
          ...rows.reduce((s, r) => {
            Object.keys(r).forEach((k) => s.add(k));
            return s;
          }, new Set()),
        ];

    stream.write(cols.map(escapeCell).join(',') + '\n');
    rows.forEach((row) => stream.write(cols.map((c) => escapeCell(row[c])).join(',') + '\n'));
    stream.end();
  });

// ─── Pipeline principal ───────────────────────────────────────────────────────

/**
 * Scrape, nettoie et écrit un CSV.
 *
 * @param {{ id: string, scrapeData: object, outputDir: string }}
 * @returns {Promise<{ outputFile: string, summary: object }>}
 */
const executeScrapeToCsv = async ({ id, scrapeData, outputDir, meta = {} }) => {
  const t0 = Date.now();
  const maxAttempts = Number(scrapeData.max_attempts || DEFAULT_MAX_ATTEMPTS);
  const timeoutMs = Number(scrapeData.timeout_ms || DEFAULT_TIMEOUT_MS);

  const rawRows = await scrapeWithRetry(scrapeData, maxAttempts, timeoutMs);
  const cleanedRows = rawRows.map(cleanRow);

  const fields = getFields(cleanedRows);

  warnEmptyFields(cleanedRows, id, fields);

  const outputFile = path.join(outputDir, `${id}.csv`);
  await writeCsv(outputFile, cleanedRows, fields);
  console.log('[csv] ✅', meta.nom_boutique || id, '📈 Total de lignes :', cleanedRows.length);

  return {
    outputFile,
    rows: cleanedRows,
    summary: {
      rawRows: rawRows.length,
      dedupedRows: cleanedRows.length,
      duplicates: 0,
      durationMs: Date.now() - t0,
    },
  };
};

module.exports = { executeScrapeToCsv };
