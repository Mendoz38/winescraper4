const path = require('path');
const axios = require('axios');
const slug = require('slug');
const { scrape } = require('../routes/scraper');
const { executeScrapeToCsv } = require('./scrape-to-csv');

const csvOutputDir = path.join(__dirname, '..', 'csv');
const backBaseUrl = process.env.WS_BACK_BASE_URL;

module.exports = (app) => {
  // Aperçu brut (pas de CSV, pas de déduplication)
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

  // Run complet → CSV (payload POST)
  app.post('/run', async (req, res) => {
    try {
      const { id, scrapeData, meta } = req.body;
      console.log('[routes] run:start id=', id);
      const result = await executeScrapeToCsv({ id, scrapeData, outputDir: csvOutputDir, meta });

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

  // Téléchargement du CSV généré
  app.get('/download/:id/:name', (req, res) => {
    const file = path.join(csvOutputDir, `${req.params.id}.csv`);
    res.download(file, slug(req.params.name) + '.csv');
  });
};
