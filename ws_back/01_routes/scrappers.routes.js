const express = require("express");
const db = require("../00_utils/db");
const ScrapperModel = require("../02_models/scrapper.model")(db);

const router = express.Router();

function sendError(res, error) {
  return res.status(error.status || 500).json({ error: error.message });
}

// route pour voir le résultat du scrapping dans le navigateur
router.get("/:id/view", async (req, res) => {
  try {
    const data = await ScrapperModel.viewScrapper(req.params.id);
    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
});

// route pour lancer le scraping et mettre à jour last_run
router.get("/:id/run", async (req, res) => {
  try {
    const data = await ScrapperModel.runScrapper(req.params.id);
    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
});

// route pour télécharger le CSV généré pour un scrapper
router.get("/:id/download", async (req, res) => {
  try {
    const file = await ScrapperModel.downloadScrapper(req.params.id, req.query.name);
    res.setHeader("content-type", file.headers.contentType);
    res.setHeader("content-disposition", file.headers.contentDisposition);
    return res.send(file.data);
  } catch (error) {
    return sendError(res, error);
  }
});

// route pour lister tous les scrappers (option active=true|1)
router.get("/", async (req, res) => {
  try {
    const onlyActive = req.query.active === "1" || req.query.active === "true";
    const items = await ScrapperModel.getAllScrappers({ activeOnly: onlyActive });
    return res.json(items);
  } catch (error) {
    return sendError(res, error);
  }
});

// route pour récupérer un scrapper par son id
router.get("/:id", async (req, res) => {
  try {
    const item = await ScrapperModel.getScrapperById(req.params.id);

    if (item.code) {
      return res.status(item.code).json({ error: item.message });
    }

    return res.json(item);
  } catch (error) {
    return sendError(res, error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const item = await ScrapperModel.updateScrapper(req.params.id, req.body);
    return res.json(item);
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
