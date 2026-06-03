const cheerio = require('cheerio');
const { fetchHtml } = require('./html-fetcher');
const { parseFields } = require('./dom-parser');

const MAX_PAGES = 50;
const DEFAULT_CONCURRENCY = Number(process.env.SCRAPE_CONCURRENCY || 3);

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

const fetchSinglePage = async (url, opts) => {
  const html = await fetchHtml(url, opts);
  return [{ $: cheerio.load(html), sourceUrl: url }];
};

/**
 * Suit la pagination d'une URL jusqu'à MAX_PAGES, absence de lien suivant,
 * ou absence de produits sur la page (détection de page vide).
 */
const followPagination = async (startUrl, paginationSelector, opts, maxPages, itemSelector) => {
  const pages = [];
  const visited = new Set();
  let nextUrl = startUrl;

  while (nextUrl && pages.length < maxPages && !visited.has(nextUrl)) {
    console.log('[scraper] pagination:page', pages.length + 1);
    visited.add(nextUrl);
    const html = await fetchHtml(nextUrl, opts);
    const $ = cheerio.load(html);

    // Stop si la page ne contient aucun produit
    if (itemSelector && $(itemSelector).length === 0) {
      console.log('[scraper] pagination:stop reason= no-items pages=', pages.length);
      break;
    }

    pages.push({ $, sourceUrl: nextUrl });

    const href = $(paginationSelector).first().attr('href');
    if (!href) break;

    try {
      nextUrl = new URL(href, nextUrl).toString();
    } catch {
      break;
    }
  }

  console.log('[scraper] pagination:done url=', startUrl, 'pages=', pages.length);
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
    console.log('[scraper] fetchAllPages urls=', urls.length, 'pagination=', Boolean(pagination));
    const buckets = await mapWithConcurrency(urls, concurrency, (seedUrl) =>
      pagination ? followPagination(seedUrl, pagination, opts, max_pages, itemSelector) : fetchSinglePage(seedUrl, opts)
    );
    return buckets.flat();
  }

  return pagination ? followPagination(urls[0], pagination, opts, max_pages, itemSelector) : fetchSinglePage(urls[0], opts);
};

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Extrait les lignes depuis les pages fetchées.
 * dataConfig suit le format : { csv: [itemSelector, fieldMap], ...metaFields }
 */
const extractRows = (pages, dataConfig) => {
  const rows = [];

  for (const { $ } of pages) {
    const result = parseFields($, dataConfig);
    if (!Array.isArray(result.csv)) continue;

    const meta = Object.fromEntries(Object.entries(result).filter(([k]) => k !== 'csv'));
    for (const row of result.csv) {
      if (row && typeof row === 'object') rows.push({ ...row, ...meta });
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

  const pages = await fetchAllPages(config);
  const rows = extractRows(pages, config.data);
  console.log('[scraper] done pages=', pages.length, 'rows=', rows.length);
  return rows;
};

module.exports = { scrape };
