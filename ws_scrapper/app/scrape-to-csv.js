const fs = require('fs');
const path = require('path');
const { scrape } = require('../routes/scraper');
const { epur } = require('../routes/text-utils');

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 180_000;

// ─── Retry avec backoff linéaire ─────────────────────────────────────────────

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout après ${ms}ms`)), ms))]);

const scrapeWithRetry = async (config, maxAttempts, timeoutMs) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log('[csv] scrape:attempt', attempt, '/', maxAttempts);
      return await withTimeout(scrape(config), timeoutMs);
    } catch (err) {
      lastError = err;
      console.log('[csv] scrape:failed attempt=', attempt, 'error=', err?.message ?? String(err));
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastError;
};

// ─── Nettoyage des lignes ─────────────────────────────────────────────────────

const cleanRow = (row) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? '' : typeof v === 'string' ? (epur(v) ?? '') : v]));

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

// ─── Déduplication ────────────────────────────────────────────────────────────

const dedupeRows = (rows) => {
  const seen = new Set();
  let duplicates = 0;
  const out = [];

  for (const row of rows) {
    const key = row.link?.trim()
      ? `link§${row.link.trim()}`
      : `combo§${[row.domaine, row.cuvee, row.prix]
          .map((v) =>
            String(v ?? '')
              .trim()
              .toLowerCase()
          )
          .join('|')}`;

    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    } else duplicates++;
  }

  return { rows: out, duplicates };
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
 * Scrape, nettoie, déduplique et écrit un CSV.
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

  const { rows, duplicates } = dedupeRows(cleanedRows);
  const fields = getFields(rows);

  warnEmptyFields(rows, id, fields);

  const outputFile = path.join(outputDir, `${id}.csv`);
  await writeCsv(outputFile, rows, fields);
  console.log('[csv] ✅', meta.nom_boutique || id, '📈 Total de lignes :', rows.length);

  return {
    outputFile,
    summary: {
      rawRows: rawRows.length,
      dedupedRows: rows.length,
      duplicates,
      durationMs: Date.now() - t0,
    },
  };
};

module.exports = { executeScrapeToCsv };
