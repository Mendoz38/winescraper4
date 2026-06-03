const axios = require('axios');
const puppeteer = require('puppeteer-core');

let runtimeConfig = {};
try {
  runtimeConfig = require('../.env');
} catch {}

const AXIOS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  Connection: 'keep-alive',
};

const BROWSER_EXEC = process.env.BROWSER_EXEC || runtimeConfig.BROWSER_EXEC;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Fetch simple (axios) ────────────────────────────────────────────────────

const fetchEasy = async (url) => {
  console.log('[fetcher] easy:request url=', url);
  const { status, data } = await axios.get(url, {
    responseType: 'text',
    headers: AXIOS_HEADERS,
    timeout: 30000,
    validateStatus: () => true,
  });
  if (status !== 200) throw new Error(`HTTP ${status} on ${url}`);
  return data;
};

// ─── Fetch JS-rendu (puppeteer) ──────────────────────────────────────────────

let _browser = null;

const getBrowser = async () => {
  if (!_browser) {
    _browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(BROWSER_EXEC && { executablePath: BROWSER_EXEC }),
    });
    _browser.on('disconnected', () => {
      _browser = null;
    });
  }
  return _browser;
};

/** Défile toute la page pour déclencher le lazy-loading. */
const scrollFull = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        let scrolled = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, 450);
          scrolled += 450;
          if (scrolled >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      })
  );

/** Clique répétitivement sur un bouton "voir plus" jusqu'à sa disparition. */
const clickLoadMoreUntilGone = async (page, selector) => {
  if (!selector) return;
  for (let i = 0; i < 200; i++) {
    try {
      console.log('[fetcher] lazy:clic load more : ', i + 1);
      await page.$eval(selector, (el) => {
        el.scrollIntoView();
        el.click();
      });
      await wait(500);
    } catch {
      break;
    }
  }
};

/** Force src sur les images dont currentSrc est déjà résolu. */
const materializeImages = (page) =>
  page.evaluate(() => {
    document.querySelectorAll('img').forEach((img) => {
      if (!img.getAttribute('src') && img.currentSrc) img.setAttribute('src', img.currentSrc);
    });
  });

const fetchLazy = async (url, { loadMore } = {}) => {
  console.log('[fetcher] lazy:request url=', url);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1366, height: 900 });
    await page.setUserAgent(AXIOS_HEADERS['User-Agent']);
    await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });
    await wait(1500);
    await scrollFull(page);
    await wait(1000);
    await clickLoadMoreUntilGone(page, loadMore);
    await materializeImages(page);
    const html = await page.content();
    return html;
  } finally {
    await page.close();
  }
};

// ─── Interface publique ──────────────────────────────────────────────────────

/**
 * Récupère le HTML d'une URL.
 * @param {string} url
 * @param {{ lazy?: boolean, loadMore?: string }} options
 */
const fetchHtml = (url, { lazy = false, loadMore } = {}) => (lazy ? fetchLazy(url, { loadMore }) : fetchEasy(url));

const closeBrowser = async () => {
  if (_browser) {
    const b = _browser;
    _browser = null;
    await b.close();
  }
};

process.on('exit', () => {
  _browser?.close().catch(() => {});
});

module.exports = { fetchHtml, closeBrowser };
