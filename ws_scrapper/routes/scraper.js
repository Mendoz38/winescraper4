const cheerio = require('cheerio');
const { fetchHtml } = require('./html-fetcher');
const { parseFields } = require('./dom-parser');
const path = require('path');

let runtimeConfig = {};
try {
  runtimeConfig = require(path.join(__dirname, '..', '.env'));
} catch (error) {
  runtimeConfig = {};
}

const MAX_PAGES_DEFAULT = 50;
const DEFAULT_CONCURRENCY = Number(runtimeConfig.SCRAPE_CONCURRENCY || 3);

const expandRangedUrl = (value) => {
  if (typeof value !== 'string') return [];

  const match = value.match(/\[(\d+)-(\d+)\]/);
  if (!match) return [value];

  const startRaw = match[1];
  const endRaw = match[2];
  const start = Number(startRaw);
  const end = Number(endRaw);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return [value];

  const step = start <= end ? 1 : -1;
  const width = startRaw.length;
  const urls = [];

  for (let current = start; step > 0 ? current <= end : current >= end; current += step) {
    const page = String(current).padStart(width, '0');
    urls.push(value.replace(match[0], page));
  }

  return urls;
};

const expandUrls = (input) => {
  if (Array.isArray(input)) return input.flatMap(expandRangedUrl);
  return expandRangedUrl(input);
};

const mapWithConcurrency = async (items, limit, mapper) => {
  if (!items.length) return [];
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
};

/**
 * Récupère toutes les pages d'un site (pagination ou liste d'URLs).
 * Retourne un tableau de { $, sourceUrl }.
 */
const fetchAllPages = async (config) => {
  const { url, pagination, load_more, max_pages = MAX_PAGES_DEFAULT } = config;
  const isLazy = config.mode === 'lazy';
  const opts = { lazy: isLazy, loadMore: load_more };
  const concurrency = Math.max(1, Number(config.scrape_concurrency || runtimeConfig.SCRAPE_CONCURRENCY || DEFAULT_CONCURRENCY));
  const expandedUrls = expandUrls(url);

  // Liste d'URLs explicite (ou URL avec intervalle [x-y])
  if (expandedUrls.length > 1 || Array.isArray(url)) {
    console.log(
      '[routes2:scraper] fetchAllPages:start',
      'mode=',
      config.mode,
      'urls=',
      expandedUrls.length,
      'pagination=',
      Boolean(pagination),
      'maxPages=',
      max_pages,
      'concurrency=',
      concurrency
    );

    const buckets = await mapWithConcurrency(expandedUrls, concurrency, async (seedUrl) => {
      const pages = pagination ? await followPagination(seedUrl, pagination, opts, max_pages) : await fetchSinglePage(seedUrl, opts);
      return pages;
    });

    const merged = buckets.flat();
    console.log('[routes2:scraper] fetchAllPages:done', 'totalPages=', merged.length);
    return merged;
  }

  // URL unique avec pagination auto
  if (pagination) {
    const seedUrl = expandedUrls[0];
    console.log(
      '[routes2:scraper] fetchAllPages:start',
      'mode=',
      config.mode,
      'url=',
      seedUrl,
      'pagination=',
      true,
      'maxPages=',
      max_pages
    );
    return followPagination(seedUrl, pagination, opts, max_pages);
  }

  // URL unique simple
  const pages = await fetchSinglePage(expandedUrls[0], opts);
  console.log('[routes2:scraper] fetchAllPages:done', 'totalPages=', pages.length);
  return pages;
};

const fetchSinglePage = async (url, opts) => {
  const html = await fetchHtml(url, opts);
  return [{ $: cheerio.load(html), sourceUrl: url }];
};

const followPagination = async (startUrl, paginationSelector, opts, maxPages) => {
  const pages = [];
  const visited = new Set();
  let nextUrl = startUrl;

  while (nextUrl && pages.length < maxPages && !visited.has(nextUrl)) {
    console.log('[routes2:scraper] pagination:page', 'index=', pages.length + 1, 'url=', nextUrl);
    visited.add(nextUrl);
    const html = await fetchHtml(nextUrl, opts);
    const $ = cheerio.load(html);
    pages.push({ $, sourceUrl: nextUrl });

    const href = $(paginationSelector).first().attr('href');
    if (!href) {
      console.log('[routes2:scraper] pagination:stop', 'reason=', 'no-next-link', 'pages=', pages.length);
      break;
    }
    try {
      nextUrl = new URL(href, nextUrl).toString();
      if (visited.has(nextUrl)) {
        console.log('[routes2:scraper] pagination:stop', 'reason=', 'loop-detected', 'nextUrl=', nextUrl, 'pages=', pages.length);
      }
    } catch (error) {
      console.log('[routes2:scraper] pagination:stop', 'reason=', 'invalid-next-url', 'href=', href, 'pages=', pages.length);
      break;
    }
  }

  if (pages.length >= maxPages) {
    console.log('[routes2:scraper] pagination:stop', 'reason=', 'max-pages-reached', 'maxPages=', maxPages);
  }

  console.log('[routes2:scraper] pagination:done', 'url=', startUrl, 'pages=', pages.length);

  return pages;
};

/**
 * Extrait les lignes depuis un ensemble de pages.
 * dataConfig suit le format config.json : { csv: [selector, fieldMap], ...otherFields }
 */
const extractRows = (pages, dataConfig) => {
  const rows = [];

  pages.forEach(({ $ }) => {
    const result = parseFields($, dataConfig);

    // La clé "csv" est la liste de produits
    if (Array.isArray(result.csv)) {
      const meta = buildMeta(result);
      result.csv.forEach((row) => {
        if (row && typeof row === 'object') rows.push({ ...row, ...meta });
      });
    }
  });

  return rows;
};

const buildMeta = (result) => {
  const meta = {};
  Object.keys(result).forEach((key) => {
    if (key !== 'csv') meta[key] = result[key];
  });
  return meta;
};

/**
 * Interface publique unique.
 * @param {object} config  scrapeData du config.json
 * @returns {Promise<Row[]>}
 */
const scrape = async (config) => {
  if (!config || !config.data || !config.url) {
    throw new Error('Invalid scrape config: expected url and data fields');
  }

  const pages = await fetchAllPages(config);
  const rows = extractRows(pages, config.data);
  console.log('[routes2:scraper] scrape:done', 'pages=', pages.length, 'rows=', rows.length);
  return rows;
};

module.exports = { scrape };
