const express = require('express');
const { replaceBoutiqueRows } = require('../02_models/boutique.model');

const router = express.Router();

const sendError = (res, error) => res.status(error.status || 500).json({ error: error.message });

//--------- INSERT boutiques by scrape ------------//
router.post('/:boutique/import', async (req, res) => {
  try {
    const data = await replaceBoutiqueRows({
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
