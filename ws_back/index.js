const express = require('express');
const cors = require('cors');

const { query } = require('./00_utils/db');
const scrappersRoutes = require('./01_routes/scrappers.routes');
const boutiquesRoutes = require('./01_routes/boutiques.routes');
const vigneronsRoutes = require('./01_routes/vignerons.routes');
const { createCronScheduler } = require('./03_services/scrapper-cron.service');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/scrap', scrappersRoutes);
app.use('/boutiques', boutiquesRoutes);
app.use('/vignerons', vigneronsRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/ready', async (_req, res) => {
  try {
    await query('SELECT 1 as ok');
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not-ready', error: error.message });
  }
});

const cronScheduler = createCronScheduler();

app.listen(port, () => {
  console.log(`
    ws_back, En mode ${process.env.NODE_ENV} sur le Port : ${process.env.PORT} 
    du host ${process.env.DB_HOST}  user : ${process.env.DB_USER}  de la BDD ${process.env.DB_NAME}
    cors d'accès : ${process.env.CORS_ORIGIN}
    `);

  cronScheduler.start();
});
