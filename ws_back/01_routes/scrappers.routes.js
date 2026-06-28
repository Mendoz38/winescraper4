const express = require('express');
const { getAllScrappers, getScrapperById, updateScrapper, viewScrapper, runScrapper } = require('../02_models/scrapper.model');

const router = express.Router();

const sendError = (res, error) => res.status(error.status || 500).json({ error: error.message });

// route pour lister tous les scrappers (option active=true|1)
router.get('/', async (req, res) => {
  try {
    const onlyActive = req.query.active === '1' || req.query.active === 'true';
    return res.json(await getAllScrappers({ activeOnly: onlyActive }));
  } catch (error) {
    return sendError(res, error);
  }
});

// route pour voir le résultat du scrapping dans le navigateur
router.get('/:id/view', async (req, res) => {
  try {
    return res.json(await viewScrapper(req.params.id));
  } catch (error) {
    return sendError(res, error);
  }
});

// route pour lancer le scraping et mettre à jour last_run
router.get('/:id/run', async (req, res) => {
  try {
    return res.json(await runScrapper(req.params.id));
  } catch (error) {
    return sendError(res, error);
  }
});

// route pour récupérer un scrapper par son id
router.get('/:id', async (req, res) => {
  try {
    const item = await getScrapperById(req.params.id);
    if (item.code) return res.status(item.code).json({ error: item.message });
    return res.json(item);
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id', async (req, res) => {
  try {
    return res.json(await updateScrapper(req.params.id, req.body));
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
