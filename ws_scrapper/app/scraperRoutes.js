const path = require('path');
const slug = require('slug');
const { scrape } = require('../routes/scraper');
const { executeScrapeToCsv } = require('./scrape-to-csv');

/**
 * Valide et extrait le payload d'une requête de scraping.
 * Attend : { id, scrapeData: { url, data, ... }, meta? }
 */
const parseScrapePayload = (body = {}) => {
  const { id, scrapeData, meta = {} } = body;
  if (!id) throw new Error('Champ manquant : id');
  if (!scrapeData?.url || !scrapeData?.data) throw new Error('Champ manquant : scrapeData.url / scrapeData.data');
  return { id, scrapeData, meta };
};

const csvOutputDir = path.join(__dirname, '..', 'csv');

module.exports = (app) => {
  // Aperçu brut (pas de CSV, pas de déduplication)
  app.post('/scrape', async (req, res) => {
    try {
      const { id, scrapeData } = parseScrapePayload(req.body);
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
      const { id, scrapeData, meta } = parseScrapePayload(req.body);
      console.log('[routes] run:start id=', id);
      const result = await executeScrapeToCsv({ id, scrapeData, outputDir: csvOutputDir });
      res.json({ status: 'success', data: meta, summary: result.summary });
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
