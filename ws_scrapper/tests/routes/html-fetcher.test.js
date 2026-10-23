import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const cheerio = require('cheerio');
const { fetchHtml, closeBrowser } = require('../../routes/html-fetcher');
const { startServer } = require('../helpers/server');

describe('fetchHtml — mode simple (axios)', () => {
  let server;

  beforeAll(async () => {
    server = await startServer({
      '/ok': '<h1>Bonjour</h1>',
      '/blocked': { status: 403, body: 'Forbidden' },
      '/limited': { status: 429, body: 'Too Many Requests', headers: { 'retry-after': '7' } },
      '/limited-no-header': { status: 429, body: 'slow down' },
    });
  });

  afterAll(() => server.close());

  it('retourne le HTML sur un 200', async () => {
    expect(await fetchHtml(`${server.url}/ok`)).toBe('<h1>Bonjour</h1>');
  });

  it('envoie un User-Agent de navigateur et la langue française', async () => {
    await fetchHtml(`${server.url}/ok`);
    const { headers } = server.requests.at(-1);
    expect(headers['user-agent']).toMatch(/Mozilla\/5\.0/);
    expect(headers['accept-language']).toMatch(/^fr-FR/);
  });

  it('lève une erreur portant le statut HTTP', async () => {
    await expect(fetchHtml(`${server.url}/blocked`)).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/HTTP 403/) });
  });

  it('convertit Retry-After en millisecondes sur un 429', async () => {
    await expect(fetchHtml(`${server.url}/limited`)).rejects.toMatchObject({ status: 429, retryAfterMs: 7000 });
  });

  it('pas de retryAfterMs sans en-tête Retry-After', async () => {
    const err = await fetchHtml(`${server.url}/limited-no-header`).catch((e) => e);
    expect(err.status).toBe(429);
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('ne fait qu’une seule tentative (le retry est géré par scraper.js)', async () => {
    const before = server.hits['/blocked'] ?? 0;
    await fetchHtml(`${server.url}/blocked`).catch(() => {});
    expect(server.hits['/blocked']).toBe(before + 1);
  });
});

// Nécessite un Chrome/Chromium : BROWSER_EXEC=/usr/bin/chromium-browser (conteneur) ou le chemin de Chrome en local
describe.skipIf(!process.env.BROWSER_EXEC)('fetchHtml — mode lazy (puppeteer)', () => {
  let server;

  const lazyPage = `<!doctype html><html><body style="min-height:3000px">
    <ul id="list"></ul>
    <button id="more">Voir plus</button>
    <script>
      const list = document.getElementById('list');
      const add = (n) => { for (let i = 0; i < n; i++) list.insertAdjacentHTML('beforeend', '<li class="product">Vin ' + (list.children.length + 1) + '</li>'); };
      setTimeout(() => add(3), 200);
      let clicks = 0;
      document.getElementById('more').addEventListener('click', (e) => {
        add(2);
        if (++clicks === 2) e.target.remove();
      });
    </script>
  </body></html>`;

  beforeAll(async () => {
    server = await startServer({ '/lazy': lazyPage, '/gone': { status: 410, body: 'Gone' } });
  });

  afterAll(async () => {
    await closeBrowser();
    await server.close();
  });

  it('récupère le contenu injecté en JavaScript et clique sur « voir plus » jusqu’à disparition', async () => {
    const html = await fetchHtml(`${server.url}/lazy`, { lazy: true, loadMore: '#more' });
    const $ = cheerio.load(html);
    expect($('li.product')).toHaveLength(7);
    expect($('#more')).toHaveLength(0);
  }, 30000);

  it('lève une erreur sur un statut >= 400', async () => {
    await expect(fetchHtml(`${server.url}/gone`, { lazy: true })).rejects.toMatchObject({ status: 410 });
  }, 30000);
});
