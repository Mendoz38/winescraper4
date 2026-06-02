const fs = require('fs');
const path = require('path');
const { scrape } = require('../routes/scraper');
const { epur } = require('../routes/text-utils');

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 180000;

// ─── Retry avec backoff ────────────────────────────────────────────────────────

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Scrape timeout after ${ms}ms`)), ms))]);

const scrapeWithRetry = async (config, maxAttempts = DEFAULT_MAX_ATTEMPTS, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log('[app2:csv] scrape:attempt', attempt, '/', maxAttempts, 'timeoutMs=', timeoutMs);
      return await withTimeout(scrape(config), timeoutMs);
    } catch (err) {
      lastError = err;
      console.log('[app2:csv] scrape:attempt-failed', 'attempt=', attempt, 'error=', err && err.message ? err.message : String(err));
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastError;
};

// ─── Normalisation ────────────────────────────────────────────────────────────

const cleanValue = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string') return v;
  return epur(v) || '';
};

const cleanRow = (row) => {
  const out = {};
  Object.keys(row).forEach((key) => {
    out[key] = cleanValue(row[key]);
  });
  return out;
};

// ─── Validation ───────────────────────────────────────────────────────────────

const inferRequiredFields = (scrapeData) => {
  const csvConfig = scrapeData?.data?.csv;
  if (!Array.isArray(csvConfig) || typeof csvConfig[1] !== 'object') return [];
  return Object.keys(csvConfig[1]);
};

const isRowUseful = (row, fields) => {
  const keys = fields.length ? fields : Object.keys(row);
  return keys.some((k) => {
    const v = row[k];
    return v !== null && v !== undefined && String(v).trim().length > 0;
  });
};

// ─── Déduplication ────────────────────────────────────────────────────────────

const dedupeRows = (rows) => {
  const seen = new Set();
  const out = [];
  let duplicates = 0;

  rows.forEach((row) => {
    const key =
      row.link && String(row.link).trim()
        ? `link§${String(row.link).trim()}`
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
    } else {
      duplicates++;
    }
  });

  return { rows: out, duplicates };
};

// ─── Export CSV (streaming) ───────────────────────────────────────────────────

const escapeCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
};

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
      : Array.from(
          rows.reduce((s, r) => {
            Object.keys(r).forEach((k) => s.add(k));
            return s;
          }, new Set())
        );

    stream.write(cols.map(escapeCell).join(',') + '\n');
    rows.forEach((row) => stream.write(cols.map((c) => escapeCell(row[c])).join(',') + '\n'));
    stream.end();
  });

// ─── Pipeline principal ───────────────────────────────────────────────────────

/**
 * @param {{ id: string, scrapeData: object, outputDir: string }}
 * @returns {Promise<{ outputFile: string, summary: object }>}
 */
const executeScrapeToCsv = async ({ id, scrapeData, outputDir }) => {
  const t0 = Date.now();

  const maxAttempts = Number(scrapeData.max_attempts || DEFAULT_MAX_ATTEMPTS);
  const timeoutMs = Number(scrapeData.timeout_ms || DEFAULT_TIMEOUT_MS);

  const rawRows = await scrapeWithRetry(scrapeData, maxAttempts, timeoutMs);
  const requiredFields = inferRequiredFields(scrapeData);

  const cleanedRows = rawRows.map(cleanRow);
  const validRows = cleanedRows.filter((row) => isRowUseful(row, requiredFields));
  const { rows, duplicates } = dedupeRows(validRows);
  const invalidRows = cleanedRows.length - validRows.length;

  const outputFile = path.join(outputDir, `${id}.csv`);
  await writeCsv(outputFile, rows, requiredFields);
  console.log('[app2:csv] csv:written', 'id=', id, 'outputFile=', outputFile, 'Total=', rows.length);

  return {
    outputFile,
    summary: {
      rawRows: rawRows.length,
      validRows: validRows.length,
      dedupedRows: rows.length,
      invalidRows,
      duplicates,
      maxAttempts,
      timeoutMs,
      durationMs: Date.now() - t0,
    },
  };
};

module.exports = { executeScrapeToCsv };
