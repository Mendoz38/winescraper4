const express = require('express');
const db = require('../00_utils/db');
const VigneronsModel = require('../02_models/vignerons.model')(db);

const router = express.Router();

function sendError(res, error) {
  return res.status(error.status || 500).json({ error: error.message });
}

//--------- SELECT dénomination VIGNERONS ------------//
router.get('/', async (req, res) => {
  try {
    const items = await VigneronsModel.getVigneronsSite();
    return res.json(items);
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
