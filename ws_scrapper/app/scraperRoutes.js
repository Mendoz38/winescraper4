const axios = require('axios');
const { scrape } = require('../routes/scraper');
const { executeScrape } = require('./run-scrape');
const backBaseUrl = process.env.WS_BACK_BASE_URL;

module.exports = (app) => {
  // Aperçu brut
  app.post('/scrape', async (req, res) => {
    try {
      const { id, scrapeData } = req.body;
      console.log('[routes] scrape:start id=', id);
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
      console.log('[routes] run:start id=', id);
      const result = await executeScrape({ id, scrapeData, meta });

      const encodedBoutique = encodeURIComponent(meta.nom_boutique);
      const { data: dbImport } = await axios.post(`${backBaseUrl}/boutiques/${encodedBoutique}/import`, {
        rows: result.rows,
        meta,
      });

      res.json({ status: 'success', data: meta, summary: result.summary, dbImport });
    } catch (err) {
      console.error('[routes] run:error', err);
      res.status(500).json({ error: err?.message ?? String(err) });
    }
  });
};
