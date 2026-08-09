const cheerio = require('cheerio');
const { fetchHtml } = require('./html-fetcher');
const { parseFields } = require('./dom-parser');
const { fetchCsvRows } = require('./csv-fetcher');

const MAX_PAGES = 50;
const DEFAULT_CONCURRENCY = Number(process.env.SCRAPE_CONCURRENCY || 3);
const DELAY_BETWEEN_REQUESTS_MS = Number(process.env.SCRAPE_PAGE_DELAY_MS || 2000);
const PAGE_RETRY_ATTEMPTS = Number(process.env.SCRAPE_PAGE_RETRY_ATTEMPTS || 3);
const PAGE_RETRY_DELAY_MS = Number(process.env.SCRAPE_PAGE_RETRY_DELAY_MS || 3000);

// Plafond sur le délai de retry, même si le site (via Retry-After ou notre
// backoff) demande d'attendre plus longtemps. Évite qu'un site chatouilleux
// bloque tout le pipeline pendant 27 minutes comme observé sur jusdelavigne.fr.
const RATE_LIMIT_MAX_DELAY_MS = Number(process.env.SCRAPE_RATE_LIMIT_MAX_DELAY_MS || 15000);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const isRateLimitError = (err) => err?.status === 429 || /HTTP\s+429/i.test(String(err?.message ?? ''));

// ─── Throttle global ──────────────────────────────────────────────────────────
// Espace TOUTES les requêtes (tous workers confondus) d'au moins
// DELAY_BETWEEN_REQUESTS_MS, quel que soit le niveau de concurrency.
// Sans ça, concurrency=3 + délai "par worker" revient à taper 3x plus vite
// que prévu sur le site cible → déclenche le rate-limit bien plus tôt.
let nextAvailableAt = 0;
const throttleGate = async () => {
  const now = Date.now();
  const waitMs = Math.max(0, nextAvailableAt - now);
  nextAvailableAt = Math.max(now, nextAvailableAt) + DELAY_BETWEEN_REQUESTS_MS;
  if (waitMs > 0) await wait(waitMs);
};

/** Repousse le throttle global d'un délai supplémentaire (ex: après un 429). */
const pushThrottleBack = (extraDelayMs) => {
  nextAvailableAt = Math.max(nextAvailableAt, Date.now()) + extraDelayMs;
};

// ─── Utilitaires URL ─────────────────────────────────────────────────────────

/**
 * Développe une URL avec intervalle "[1-5]" en liste d'URLs.
 * Ex: "page=[1-3]" → ["page=1", "page=2", "page=3"]
 */
const expandRangedUrl = (value) => {
  if (typeof value !== 'string') return [];
  const match = value.match(/\[(\d+)-(\d+)\]/);
  if (!match) return [value];

  const [, startRaw, endRaw] = match;
  const start = Number(startRaw);
  const end = Number(endRaw);
  const step = start <= end ? 1 : -1;
  const urls = [];

  for (let n = start; step > 0 ? n <= end : n >= end; n += step) {
    urls.push(value.replace(match[0], String(n).padStart(startRaw.length, '0')));
  }
  return urls;
};

const expandUrls = (input) => (Array.isArray(input) ? input.flatMap(expandRangedUrl) : expandRangedUrl(input));

// ─── Concurrence ─────────────────────────────────────────────────────────────

/**
 * Applique `mapper` sur `items` avec au plus `limit` promesses simultanées.
 * L'espacement réel des requêtes est géré par `throttleGate`, pas ici.
 */
const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await mapper(items[i], i);
      }
    })
  );

  return results;
};

// ─── Fetch pages ─────────────────────────────────────────────────────────────

const fetchOpts = (config) => ({
  lazy: config.mode === 'lazy',
  loadMore: config.load_more,
});

/**
 * Fetch une page avec retry. SEUL et unique point de retry de tout le pipeline.
 */
const fetchPageWithRetry = async (url, opts, itemSelector, attempts = PAGE_RETRY_ATTEMPTS) => {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await throttleGate();

    let html;
    try {
      html = await fetchHtml(url, opts);
    } catch (err) {
      const rateLimited = isRateLimitError(err);
      console.warn(
        '[scraper] fetch:error url=',
        url,
        'attempt=',
        attempt,
        '/',
        attempts,
        rateLimited ? '(RATE LIMIT)' : '',
        'error=',
        err?.message ?? String(err)
      );

      if (attempt >= attempts) throw err;

      let delayMs;
      if (rateLimited) {
        const suggested = err.retryAfterMs > 0 ? err.retryAfterMs : PAGE_RETRY_DELAY_MS * attempt * 3;
        delayMs = Math.min(suggested, RATE_LIMIT_MAX_DELAY_MS);
        if (suggested > RATE_LIMIT_MAX_DELAY_MS) {
          console.warn(`[scraper] fetch:retry-after plafonné (${suggested}ms → ${delayMs}ms) pour éviter de bloquer la queue`);
        }
        pushThrottleBack(delayMs);
      } else {
        delayMs = PAGE_RETRY_DELAY_MS * attempt;
      }

      console.warn(`[scraper] fetch:retry url=${url} dans ${delayMs}ms`);
      await wait(delayMs);
      continue;
    }

    const $ = cheerio.load(html);
    const itemCount = itemSelector ? $(itemSelector).length : null;
    console.log('[scraper] fetch:page url=', url, 'attempt=', attempt, 'itemCount=', itemCount);

    if (!itemSelector || itemCount > 0) return { $, itemCount };

    console.warn('[scraper] fetch:page semble vide (possible blocage) url=', url, 'attempt=', attempt, '/', attempts);
    if (attempt < attempts) await wait(PAGE_RETRY_DELAY_MS * attempt);
  }

  console.warn('[scraper] fetch:page reste vide après tous les essais, abandon url=', url);
  return null;
};

const fetchSinglePage = async (url, opts, itemSelector) => {
  const result = await fetchPageWithRetry(url, opts, itemSelector);
  return result ? [{ $: result.$, sourceUrl: url }] : [];
};

/**
 * Suit la pagination d'une URL jusqu'à MAX_PAGES, absence de lien suivant,
 * ou absence de produits sur la page (détection de page vide, avec retry).
 */
const followPagination = async (startUrl, paginationSelector, opts, maxPages, itemSelector) => {
  const pages = [];
  const visited = new Set();
  let nextUrl = startUrl;

  while (nextUrl && pages.length < maxPages && !visited.has(nextUrl)) {
    // console.log('[scraper] pagination:page', pages.length + 1, 'url=', nextUrl);
    visited.add(nextUrl);

    const result = await fetchPageWithRetry(nextUrl, opts, itemSelector);

    if (!result) {
      console.log('[scraper] pagination:stop reason= no-items-after-retry pages=', pages.length);
      break;
    }

    const { $, itemCount } = result;
    // console.log('[scraper] pagination:page', pages.length + 1, 'items=', itemCount);
    pages.push({ $, sourceUrl: nextUrl });

    const href = $(paginationSelector).first().attr('href');
    if (!href) {
      console.log('[scraper] pagination:stop reason= no-next-href pages=', pages.length);
      break;
    }

    try {
      nextUrl = new URL(href, nextUrl).toString();
    } catch {
      console.log('[scraper] pagination:stop reason= bad-href pages=', pages.length, 'href=', href);
      break;
    }
  }

  console.log('[scraper] pagination:done url=', startUrl);
  return pages;
};

/**
 * Récupère toutes les pages selon la config (liste d'URLs, intervalle, ou pagination).
 */
const fetchAllPages = async (config) => {
  const { pagination, max_pages = MAX_PAGES } = config;
  const concurrency = Number(config.scrape_concurrency || DEFAULT_CONCURRENCY);
  const opts = fetchOpts(config);
  const urls = expandUrls(config.url);
  const itemSelector = config.data?.csv?.[0];

  if (urls.length > 1) {
    console.log(
      '[scraper] fetchAllPages urls=',
      urls.length,
      'pagination=',
      Boolean(pagination),
      'concurrency=',
      concurrency,
      'delayMs=',
      DELAY_BETWEEN_REQUESTS_MS
    );
    const buckets = await mapWithConcurrency(urls, concurrency, (seedUrl) =>
      pagination ? followPagination(seedUrl, pagination, opts, max_pages, itemSelector) : fetchSinglePage(seedUrl, opts, itemSelector)
    );
    const flat = buckets.flat();
    const emptyCount = buckets.filter((b) => Array.isArray(b) && b.length === 0).length;
    if (emptyCount > 0) {
      console.warn(
        '[scraper] fetchAllPages:warning',
        emptyCount,
        'page(s) sur',
        urls.length,
        "n'ont retourné aucun contenu (voir logs 'fetch:page reste vide' ci-dessus)"
      );
    }
    return flat;
  }

  return pagination ? followPagination(urls[0], pagination, opts, max_pages, itemSelector) : fetchSinglePage(urls[0], opts, itemSelector);
};

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Extrait les lignes depuis les pages fetchées.
 * dataConfig suit le format : { csv: [itemSelector, fieldMap], ...metaFields }
 */
const extractRows = (pages, dataConfig, categoryLabel) => {
  const rows = [];

  for (const { $ } of pages) {
    const result = parseFields($, dataConfig);
    if (!Array.isArray(result.csv)) continue;

    const meta = Object.fromEntries(Object.entries(result).filter(([k]) => k !== 'csv'));
    for (const row of result.csv) {
      if (row && typeof row === 'object') {
        const merged = { ...row, ...meta };
        if (categoryLabel && !merged.domaine) merged.domaine = categoryLabel;
        rows.push(merged);
      }
    }
  }

  return rows;
};

// ─── Interface publique ───────────────────────────────────────────────────────

/**
 * Lance le scraping complet d'une config.
 * @param {{ url: string|string[], data: object, mode?: string, pagination?: string, load_more?: string }} config
 * @returns {Promise<object[]>}
 */
const scrape = async (config) => {
  if (!config?.url || !config?.data) throw new Error('config: url et data sont requis');

  if (config.mode === 'csv') {
    const urls = expandUrls(config.url);
    const buckets = await Promise.all(urls.map((u) => fetchCsvRows(u, config.data.csvSource)));
    const rows = buckets.flat();
    console.log('[scraper] done (csv) urls=', urls.length, 'Lignes=', rows.length);
    return rows;
  }

  const pages = await fetchAllPages(config);
  const categoryLabel =
    typeof config.data?.category === 'string' && config.data.category.trim() ? config.data.category.trim() : config.sel_category;
  const rows = extractRows(pages, config.data, categoryLabel);
  console.log('[scraper] done pages=', pages.length, 'Lignes=', rows.length);
  return rows;
};

module.exports = { scrape };
