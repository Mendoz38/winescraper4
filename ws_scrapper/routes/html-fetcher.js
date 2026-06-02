const axios = require('axios');
const puppeteer = require('puppeteer-core');
const path = require('path');

let runtimeConfig = {};
try {
  runtimeConfig = require(path.join(__dirname, '..', '.env'));
} catch (error) {
  runtimeConfig = {};
}

const AXIOS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  Connection: 'keep-alive',
};

const BROWSER_EXEC = process.env.BROWSER_EXEC || runtimeConfig.BROWSER_EXEC;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Easy (axios) ─────────────────────────────────────────────────────────────

const fetchEasy = async (url) => {
  console.log('[routes2:fetcher] easy:request', 'url=', url);
  const response = await axios.get(url, {
    responseType: 'text',
    headers: AXIOS_HEADERS,
    timeout: 30000,
    validateStatus: () => true,
  });
  if (response.status !== 200) throw new Error(`HTTP ${response.status} on ${url}`);
  console.log('[routes2:fetcher] easy:response', 'url=', url, 'status=', response.status, 'bytes=', String(response.data || '').length);
  return response.data;
};

// ─── Lazy (puppeteer) ─────────────────────────────────────────────────────────

let _browser = null;

const getBrowser = async () => {
  if (!_browser) {
    const launchOptions = {
      headless: true,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };

    if (BROWSER_EXEC) launchOptions.executablePath = BROWSER_EXEC;

    _browser = await puppeteer.launch({
      ...launchOptions,
    });
    // console.log('[routes2:fetcher] lazy:browser-started', 'executablePath=', launchOptions.executablePath || 'default');

    _browser.on('disconnected', () => {
      _browser = null;
    });
  }
  return _browser;
};

const scrollFull = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        let scrolled = 0;
        const step = 450;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          scrolled += step;
          if (scrolled >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      })
  );

const clickLoadMoreUntilGone = async (page, selector) => {
  if (!selector) return;
  let clicks = 0;
  for (let i = 0; i < 200; i++) {
    try {
      await page.$eval(selector, (el) => {
        el.scrollIntoView();
        el.click();
      });
      await wait(500);
      clicks += 1;
    } catch {
      break;
    }
  }
  //   console.log('[routes2:fetcher] lazy:load-more', 'selector=', selector, 'clicks=', clicks);
};

const materializeImages = (page) =>
  page.evaluate(() => {
    document.querySelectorAll('img').forEach((img) => {
      if (!img.getAttribute('src') && img.currentSrc) img.setAttribute('src', img.currentSrc);
    });
  });

const fetchLazy = async (url, { loadMore } = {}) => {
  //   console.log('[routes2:fetcher] lazy:request', 'url=', url, 'loadMore=', loadMore || 'none');
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
    // console.log('[routes2:fetcher] lazy:response', 'url=', url, 'bytes=', html.length);
    return html;
  } finally {
    await page.close();
  }
};

// ─── Interface publique ────────────────────────────────────────────────────────

/**
 * Récupère le HTML d'une URL.
 * @param {string} url
 * @param {{ lazy?: boolean, loadMore?: string }} options
 * @returns {Promise<string>}
 */
const fetchHtml = (url, { lazy = false, loadMore } = {}) => (lazy ? fetchLazy(url, { loadMore }) : fetchEasy(url));

const closeBrowser = async () => {
  if (_browser) {
    const current = _browser;
    _browser = null;
    await current.close();
  }
};

process.on('exit', () => {
  if (_browser) {
    _browser.close().catch(() => {});
  }
});

module.exports = { fetchHtml, closeBrowser };
