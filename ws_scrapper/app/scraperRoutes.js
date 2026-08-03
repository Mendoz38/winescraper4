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
      const dbImportLines = Array.isArray(dbImport?.result?.logs) ? dbImport.result.logs : [];
      // Si le backend a renvoyé les compteurs, les ajouter sur la même ligne "Total de lignes"
      try {
        const ins = dbImport?.result?.Insérées ?? dbImport?.result?.Inserees ?? dbImport?.result?.inserted ?? null;
        const fil = dbImport?.result?.Filtrées ?? dbImport?.result?.Filtrees ?? dbImport?.result?.filtered ?? null;
        if ((ins != null || fil != null) && Array.isArray(result.runLines)) {
          const idx = result.runLines.findIndex((l) => typeof l === 'string' && l.includes('Total de lignes'));
          if (idx !== -1) {
            const parts = [];
            if (ins != null) parts.push(`"Insérées":${ins}`);
            if (fil != null) parts.push(`"Filtrées":${fil}`);
            if (parts.length) result.runLines[idx] = `${result.runLines[idx]},${parts.join(',')}`;
          }
        }
      } catch (e) {
        // noop
      }
      console.log(
        `[LOG 6️⃣] ${JSON.stringify({ layer: 'ws_scrapper:route:success', id, importedRows: result.rows.length, dbImportLines: dbImportLines.length })}`
      );
      res.json({
        status: 'success',
        data: meta,
        summary: result.summary,
        runLines: result.runLines || [],
        dbImport,
        dbImportLines,
      });
    } catch (err) {
      console.error(`[LOG 6️⃣E] ${JSON.stringify({ layer: 'ws_scrapper:route:error', message: err?.message ?? String(err) })}`);
      const status = /HTTP\s+429/i.test(String(err?.message ?? '')) ? 429 : 500;
      res.status(status).json({ error: err?.message ?? String(err) });
    }
  });
};
