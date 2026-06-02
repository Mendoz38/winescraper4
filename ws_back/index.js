const express = require('express');
const cors = require('cors');

const db = require('./00_utils/db');
const { query } = db;
const scrappersRoutes = require('./01_routes/scrappers.routes');
const ScrapperModel = require('./02_models/scrapper.model')(db);
const { createCronScheduler } = require('./03_services/scrapper-cron.service');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/scrap', scrappersRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', async (req, res) => {
  try {
    await query('SELECT 1 as ok');
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not-ready', error: error.message });
  }
});

const cronScheduler = createCronScheduler({ scrapperModel: ScrapperModel });

app.listen(port, () => {
  console.log(`
    ws_back, En mode ${process.env.NODE_ENV} sur le Port : ${process.env.PORT} 
    du host ${process.env.DB_HOST}  user : ${process.env.DB_USER}  de la BDD ${process.env.DB_NAME}
    cors d'accès : ${process.env.CORS_ORIGIN}
    `);

  cronScheduler.start();
});
