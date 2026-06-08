const axios = require('axios');
const { toScrapperDto } = require('../00_utils/scrapper.mapper');

let db;

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

module.exports = (_db) => {
  db = _db;
  return ScrapperModel;
};

class ScrapperModel {
  static async getAllScrappers({ activeOnly = false } = {}) {
    const sql = activeOnly ? `${baseSelect} WHERE s.active = 1 ORDER BY s.id` : `${baseSelect} ORDER BY s.niveau, s.id`;
    const rows = await db.query(sql);
    return rows.map(toScrapperDto);
  }

  static async getScrapperById(id) {
    const rows = await db.query(`${baseSelect} WHERE s.id = ? LIMIT 1`, [id]);
    if (!rows.length) return { code: 404, message: 'scrapper not found' };
    return toScrapperDto(rows[0]);
  }

  static async updateScrapper(id, body) {
    await db.query(
      `UPDATE com_scrapper SET
        boutique_id = ?, thecat = ?, niveau = ?, a_scraper = ?,
        hour_cron = ?, day_cron = ?, urls = ?, mode = ?,
        pagination = ?, load_more = ?, item_selector = ?,
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
    return this.getScrapperById(id);
  }

  static async viewScrapper(id) {
    const scrapper = await this.getScrapperById(id);
    if (scrapper.code) return scrapper;
    const { data } = await axios.post(
      `${scraperBaseUrl}/scrape`,
      {
        id: scrapper.id,
        scrapeData: scrapper.scrapeData,
      },
      { auth: scraperAuth, timeout: 120000 }
    );
    return data;
  }

  static async runScrapper(id) {
    const scrapper = await this.getScrapperById(id);
    if (scrapper.code) return scrapper;
    const { data } = await axios.post(
      `${scraperBaseUrl}/run`,
      {
        id: scrapper.id,
        scrapeData: scrapper.scrapeData,
        meta: scrapper,
      },
      { auth: scraperAuth, timeout: 120000 }
    );
    await db.query(`UPDATE com_scrapper SET last_run = NOW() WHERE id = ?`, [id]);
    return data;
  }

  static async downloadScrapper(id, name) {
    const rawName = name || `scrapper_${id}`;
    const { data, headers } = await axios.get(`${scraperBaseUrl}/download/${id}/${encodeURIComponent(rawName)}`, {
      auth: scraperAuth,
      responseType: 'arraybuffer',
      timeout: 120000,
    });
    return {
      data,
      headers: {
        contentType: headers['content-type'] || 'text/csv; charset=utf-8',
        contentDisposition: headers['content-disposition'] || `attachment; filename="${rawName}.csv"`,
      },
    };
  }
}
