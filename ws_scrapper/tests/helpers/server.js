const http = require('node:http');

/**
 * Démarre un serveur HTTP local sur un port libre.
 *
 * `routes` associe un chemin (avec query string) à :
 *   - une chaîne                        → réponse 200 text/html
 *   - { status, body, headers }         → réponse fixe
 *   - un tableau de ces réponses        → une réponse par appel successif (la dernière est répétée)
 *   - (req, body) => réponse            → réponse calculée
 *
 * @returns {Promise<{ url: string, hits: Record<string, number>, requests: Array<{ path: string, method: string, headers: object, body: string }>, close: () => Promise<void> }>}
 */
const startServer = async (routes) => {
  const hits = {};
  const requests = [];

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      const path = req.url;
      const count = hits[path] ?? 0;
      hits[path] = count + 1;
      requests.push({ path, method: req.method, headers: req.headers, body });

      let route = routes[path];
      if (Array.isArray(route)) route = route[Math.min(count, route.length - 1)];
      if (typeof route === 'function') route = await route(req, body);

      if (route === undefined) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        return res.end('not found');
      }

      const { status = 200, body: payload = '', headers = {} } = typeof route === 'string' ? { body: route } : route;
      const isJson = payload !== null && typeof payload === 'object';
      res.writeHead(status, { 'content-type': isJson ? 'application/json' : 'text/html; charset=utf-8', ...headers });
      res.end(isJson ? JSON.stringify(payload) : payload);
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    hits,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

/** Page de liste produits au format habituel des cavistes. */
const productPage = (products, { next, title } = {}) => `<!doctype html>
<html><body>
  ${title ? `<h1 class="shop-title">${title}</h1>` : ''}
  <ul>
    ${products
      .map(
        (p) => `<li class="product">
      <span class="domaine">${p.domaine ?? ''}</span>
      <a class="name" href="${p.link ?? '#'}">${p.cuvee ?? ''}</a>
      <span class="price">${p.prix ?? ''}</span>
      <img src="${p.image ?? ''}">
    </li>`
      )
      .join('')}
  </ul>
  ${next ? `<a class="next" href="${next}">Suivant</a>` : ''}
</body></html>`;

/** Config de scraping correspondant à `productPage`. */
const productData = {
  csv: [
    'li.product',
    {
      domaine: '.domaine',
      cuvee: '.name',
      prix: '.price',
      link: { selector: '.name', scrape: ['attr', 'href'] },
      image: { selector: 'img', scrape: ['attr', 'src'] },
    },
  ],
};

module.exports = { startServer, productPage, productData };
