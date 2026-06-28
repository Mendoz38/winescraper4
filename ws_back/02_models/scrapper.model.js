const axios = require('axios');
const { query } = require('../00_utils/db');
const { toScrapperDto } = require('../00_utils/scrapper.mapper');

const scraperBaseUrl = process.env.SCRAPER_BASE_URL;
const scraperAuth = process.env.SCRAPER_USER ? { username: process.env.SCRAPER_USER, password: process.env.SCRAPER_PASSWORD } : undefined;

const baseSelect = `
  SELECT
    s.*,
    b.rss,
    b.nom_boutique,
    b.image,
    b.height_image,
    b.langue,
    b.niveau AS boutique_niveau,
    b.en_ligne,
    b.payant,
    b.retrait,
    b.monnaie
  FROM com_scrapper s
  LEFT JOIN com_boutiques b ON (b.id = s.boutique_id OR b.rss = s.id)
`;

async function getAllScrappers({ activeOnly = false } = {}) {
  const sql = activeOnly ? `${baseSelect} WHERE s.active = 1 ORDER BY s.id` : `${baseSelect} ORDER BY s.niveau, s.id`;
  const rows = await query(sql);
  return rows.map(toScrapperDto);
}

async function getScrapperById(id) {
  const rows = await query(`${baseSelect} WHERE s.id = ? LIMIT 1`, [id]);
  if (!rows.length) return { code: 404, message: 'scrapper not found' };
  return toScrapperDto(rows[0]);
}

async function updateScrapper(id, body) {
  await query(
    `UPDATE com_scrapper SET
      boutique_id = ?, thecat = ?, niveau = ?, a_scraper = ?,
      hour_cron = ?, day_cron = ?, urls = ?, mode = ?,
      pagination = ?, load_more = ?, item_selector = ?,
      add_url_image = ?, add_url = ?,
      sel_domaine = ?, sel_cuvee = ?, sel_prix = ?, sel_stock = ?,
      sel_image = ?, sel_link = ?, sel_category = ?, active = ?
    WHERE id = ?`,
    [
      body.boutique_id || null,
      body.thecat || null,
      body.niveau || null,
      body.a_scraper ? 1 : 0,
      body.hour_cron || null,
      body.day_cron || null,
      body.urls ? JSON.stringify(body.urls) : null,
      body.mode || null,
      body.pagination || null,
      body.load_more || null,
      body.item_selector || null,
      body.add_url_image || null,
      body.add_url || null,
      body.sel_domaine || null,
      body.sel_cuvee || null,
      body.sel_prix || null,
      body.sel_stock || null,
      body.sel_image ? JSON.stringify(body.sel_image) : null,
      body.sel_link ? JSON.stringify(body.sel_link) : null,
      body.sel_category || null,
      body.active ? 1 : 0,
      id,
    ]
  );
  return getScrapperById(id);
}

async function viewScrapper(id) {
  const scrapper = await getScrapperById(id);
  if (scrapper.code) return scrapper;
  const { data } = await axios.post(
    `${scraperBaseUrl}/scrape`,
    { id: scrapper.id, scrapeData: scrapper.scrapeData },
    { auth: scraperAuth, timeout: 120000 }
  );
  return data;
}

async function runScrapper(id) {
  const scrapper = await getScrapperById(id);
  if (scrapper.code) return scrapper;
  const { data } = await axios.post(
    `${scraperBaseUrl}/run`,
    { id: scrapper.id, scrapeData: scrapper.scrapeData, meta: scrapper },
    { auth: scraperAuth, timeout: 120000 }
  );
  await query('UPDATE com_scrapper SET last_run = NOW() WHERE id = ?', [id]);
  return data;
}

module.exports = { getAllScrappers, getScrapperById, updateScrapper, viewScrapper, runScrapper };
