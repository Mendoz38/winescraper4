const axios = require('axios');
const { scrape } = require('../routes/scraper');
const { executeScrape } = require('./run-scrape');
const backBaseUrl = process.env.WS_BACK_BASE_URL;

module.exports = (app) => {
  // Aperçu brut
  app.post('/scrape', async (req, res) => {
    try {
      const { id, scrapeData } = req.body;
      const rows = await scrape(scrapeData);
      console.log('[routes] scrape:done id=', id, 'rows=', rows.length);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  // Run complet → import BDD (payload POST)
  app.post('/run', async (req, res) => {
    try {
      const { id, scrapeData, meta } = req.body;
      console.log(`[LOG 3️⃣] ${JSON.stringify({ layer: 'ws_scrapper:route:start', id })}`);
      const result = await executeScrape({ id, scrapeData, meta });

      const encodedBoutique = encodeURIComponent(meta.nom_boutique);
      const { data: dbImport } = await axios.post(`${backBaseUrl}/ws/boutiques/${encodedBoutique}/import`, {
        rows: result.rows,
        meta,
      });
      console.log(`[LOG 6️⃣] ${JSON.stringify({ layer: 'ws_scrapper:route:success', id, importedRows: result.rows.length })}`);
      res.json({ status: 'success', data: meta, summary: result.summary, runLines: result.runLines || [], dbImport });
    } catch (err) {
      console.error(`[LOG 6️⃣E] ${JSON.stringify({ layer: 'ws_scrapper:route:error', message: err?.message ?? String(err) })}`);
      const status = /HTTP\s+429/i.test(String(err?.message ?? '')) ? 429 : 500;
      res.status(status).json({ error: err?.message ?? String(err) });
    }
  });
};
