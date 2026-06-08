const express = require('express');
const db = require('../00_utils/db');
const BoutiqueModel = require('../02_models/boutique.model')(db);

const router = express.Router();

function sendError(res, error) {
  return res.status(error.status || 500).json({ error: error.message });
}

//--------- INSERT boutiques by scrape ------------//
router.post('/:boutique/import', async (req, res) => {
  try {
    const data = await BoutiqueModel.replaceBoutiqueRows({
      boutique: req.params.boutique,
      rows: req.body?.rows,
      meta: req.body?.meta,
    });
    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
