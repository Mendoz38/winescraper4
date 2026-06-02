const path = require('path');
const axios = require('axios');
const slug = require('slug');
const _ = require('lodash');
const config = require('../.env');

const data = require('../routes/dataModel');
const { scrape } = require('../routes/scraper');
const { executeScrapeToCsv } = require('./scrape-to-csv');

const BASE_URL = `http://localhost:${config.PORT || 3000}`;
const LEGACY_CONFIG_CRON_ENABLED = String(process.env.LEGACY_CONFIG_CRON_ENABLED || 'false').toLowerCase() === 'true';

const getPostedScrapePayload = (body = {}) => {
  const id = body.id;
  const scrapeData = body.scrapeData;
  const meta = body.meta || {};

  if (!id) {
    throw new Error('missing id');
  }

  if (!scrapeData || !scrapeData.url || !scrapeData.data) {
    throw new Error('missing scrapeData');
  }

  return { id, scrapeData, meta };
};

module.exports = (app) => {
  app.post('/scrape', async (req, res) => {
    try {
      const { id, scrapeData } = getPostedScrapePayload(req.body);
      console.log('0001___scrape:start', 'id=', id, 'source=', 'request-body');
      const rows = await scrape(scrapeData);
      console.log('0002___scrape:done', 'id=', id, 'rows=', rows.length, 'source=', 'request-body');
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : String(err) });
    }
  });

  // Aperçu brut (données non filtrées, pas de CSV)
  app.get('/scrape/:id', async (req, res) => {
    try {
      console.log('0001___scrape:start', 'id=', req.params.id);
      const scrapeData = await data.getScrapeData(req.params.id);
      const rows = await scrape(scrapeData);
      console.log('0002___scrape:done', 'id=', req.params.id, 'rows=', rows.length);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : String(err) });
    }
  });

  app.post('/run', async (req, res) => {
    try {
      const { id, scrapeData, meta } = getPostedScrapePayload(req.body);
      console.log('0001___run:start', 'id=', id, 'source=', 'request-body');
      const result = await executeScrapeToCsv({
        id,
        scrapeData,
        outputDir: path.join(__dirname, '..', 'csv'),
      });

      res.json({
        status: 'success',
        data: meta,
        summary: result.summary,
      });
      console.log(
        '0009___run:done',
        'id=',
        id,
        'raw=',
        result.summary.rawRows,
        'valid=',
        result.summary.validRows,
        'deduped=',
        result.summary.dedupedRows,
        'source=',
        'request-body'
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err && err.message ? err.message : String(err) });
    }
  });

  // Run complet → CSV
  app.get('/run/:id', async (req, res) => {
    try {
      console.log('0001___run:start', 'id=', req.params.id);
      const scrapeData = await data.getScrapeData(req.params.id);
      const result = await executeScrapeToCsv({
        id: req.params.id,
        scrapeData,
        outputDir: path.join(__dirname, '..', 'csv'),
      });

      await data.updateLastRun(req.params.id);
      const siteConfig = await data.getConfigWithId(req.params.id);

      res.json({
        status: 'success',
        data: _.omit(siteConfig, 'scrapeData'),
        summary: result.summary,
      });
      console.log(
        '0009___run:done',
        'id=',
        req.params.id,
        'raw=',
        result.summary.rawRows,
        'valid=',
        result.summary.validRows,
        'deduped=',
        result.summary.dedupedRows
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err && err.message ? err.message : String(err) });
    }
  });

  // Config globale
  app.get('/config', (req, res) => {
    data
      .getConfig()
      .then((config) => res.json(config))
      .catch((err) => res.status(500).json({ error: err.message }));
  });

  // Cron legacy (config.json) - désactivé par défaut
  if (LEGACY_CONFIG_CRON_ENABLED) {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    setInterval(async () => {
      try {
        const fullConfig = await data.getConfig();
        const d = new Date();
        const currentDay = DAYS[(d.getDay() - 1 + 7) % 7];
        const currentHour = `${d.getHours() + 1}h${d.getMinutes()}`;

        Object.keys(fullConfig).forEach((key) => {
          const { day_cron, hour_cron } = fullConfig[key].scrapeData || {};
          if (!hour_cron) return;

          const dayMatch = day_cron ? day_cron === currentDay : true;
          if (dayMatch && hour_cron === currentHour) {
            console.log('0007___cron:run', 'id=', key, 'source=', 'legacy-config-json');
            axios.get(`${BASE_URL}/run/${key}`).catch(() => {});
          }
        });
      } catch (error) {
        // no-op cron guard
      }
    }, 60 * 1000);
  }

  // Config par id
  app.get('/config/:id', async (req, res) => {
    try {
      const siteConfig = await data.getConfigWithId(req.params.id);
      res.json(siteConfig);
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : String(err) });
    }
  });

  app.post('/config/:id', async (req, res) => {
    try {
      const output = await data.updateConfigWithId(req.params.id, req.body);
      res.json(output);
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : String(err) });
    }
  });

  // Téléchargement CSV
  app.get('/download/:id/:name', (req, res) => {
    const name = slug(req.params.name) + '.csv';
    const file = path.join(__dirname, '..', 'csv', req.params.id + '.csv');
    res.download(file, name);
  });

  // Suppression d'une config
  app.get('/delete/:id/', async (req, res) => {
    try {
      await data.deleteConfigWithId(req.params.id);
      res.redirect('/');
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : String(err) });
    }
  });
};
