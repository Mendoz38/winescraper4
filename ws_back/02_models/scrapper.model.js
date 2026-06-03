let db;
const axios = require('axios');
const { toScrapperDto } = require('../00_utils/scrapper.mapper');

const scraperBaseUrl = (process.env.SCRAPER_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const scraperAuth =
  process.env.SCRAPER_USER && process.env.SCRAPER_PASSWORD
    ? {
        username: process.env.SCRAPER_USER,
        password: process.env.SCRAPER_PASSWORD,
      }
    : undefined;

const baseSelect = `
  SELECT
    s.id,
    s.boutique_id,
    s.thecat,
    s.niveau,
    s.a_scraper,
    s.hour_cron,
    s.day_cron,
    s.urls,
    s.mode,
    s.pagination,
    s.load_more,
    s.item_selector,
    s.sel_domaine,
    s.sel_cuvee,
    s.sel_prix,
    s.sel_stock,
    s.sel_image,
    s.sel_link,
    s.sel_category,
    s.last_run,
    s.active,
    s.created_at,
    s.updated_at,
    b.nom_boutique,
    b.en_ligne,
    b.payant,
    b.retrait
  FROM com_scrapper s
  LEFT JOIN com_boutiques b ON b.id = s.boutique_id
`;

module.exports = (_db) => {
  db = _db;
  return ScrapperModel;
};

// helper: normalise les erreurs axios avec status HTTP
function toModelError(error) {
  const modelError = new Error(error.response?.data?.error || error.message || 'legacy scrapper error');
  modelError.status = error.response?.status || 500;
  return modelError;
}

function toRemoteScrapperPayload(scrapper) {
  return {
    id: scrapper.id,
    scrapeData: scrapper.scrapeData,
    meta: {
      id: scrapper.id,
      boutique_id: scrapper.boutique_id,
      nom_boutique: scrapper.nom_boutique,
      en_ligne: scrapper.en_ligne,
      payant: scrapper.payant,
      retrait: scrapper.retrait,
      thecat: scrapper.thecat,
      niveau: scrapper.niveau,
      a_scraper: scrapper.a_scraper,
      active: scrapper.active,
      day_cron: scrapper.day_cron,
      hour_cron: scrapper.hour_cron,
      mode: scrapper.mode,
      pagination: scrapper.pagination,
      load_more: scrapper.load_more,
      last_run: scrapper.last_run,
    },
  };
}

class ScrapperModel {
  // model: retourne la liste des scrappers (avec filtre actifs optionnel)
  static async getAllScrappers({ activeOnly = false } = {}) {
    const sql = activeOnly ? `${baseSelect} WHERE s.active = 1 ORDER BY s.id` : `${baseSelect} ORDER BY s.niveau, s.id`;

    const rows = await db.query(sql);
    return rows.map((row) => toScrapperDto(row));
  }

  // model: retourne un scrapper par id
  static async getScrapperById(id) {
    const rows = await db.query(`${baseSelect} WHERE s.id = ? LIMIT 1`, [id]);

    if (!rows.length) {
      return { code: 404, message: 'scrapper not found' };
    }
    return toScrapperDto(rows[0]);
  }

  // model: mettre à jour un scrapper
  static async updateScrapper(id, body) {
    // console.log('zzzzzzzzz', body);
    await db.query(
      `
      UPDATE com_scrapper
      SET
        boutique_id = ?,
        thecat = ?,
        niveau = ?,
        a_scraper = ?,
        hour_cron = ?,
        day_cron = ?,
        urls = ?,
        mode = ?,
        pagination = ?,
        load_more = ?,
        item_selector = ?,
        sel_domaine = ?,
        sel_cuvee = ?,
        sel_prix = ?,
        sel_stock = ?,
        sel_image = ?,
        sel_link = ?,
        sel_category = ?,
        active = ?
      WHERE id = ?
      `,
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
        body.sel_category ? JSON.stringify(body.sel_category) : null,
        body.active ? 1 : 0,
        id,
      ]
    );

    return this.getScrapperById(id);
  }

  // model: appelle le legacy pour voir le résultat du scrapping
  static async viewScrapper(id) {
    try {
      const scrapper = await this.getScrapperById(id);
      if (scrapper.code) {
        return scrapper;
      }

      const response = await axios.post(`${scraperBaseUrl}/scrape`, toRemoteScrapperPayload(scrapper), {
        auth: scraperAuth,
        timeout: 120000,
      });
      return response.data;
    } catch (error) {
      throw toModelError(error);
    }
  }

  // model: appelle le legacy pour lancer le run puis met à jour last_run
  static async runScrapper(id) {
    try {
      const scrapper = await this.getScrapperById(id);
      if (scrapper.code) {
        return scrapper;
      }

      const response = await axios.post(`${scraperBaseUrl}/run`, toRemoteScrapperPayload(scrapper), {
        auth: scraperAuth,
        timeout: 120000,
      });

      await db.query(`UPDATE com_scrapper SET last_run = NOW() WHERE id = ?`, [id]);

      return response.data;
    } catch (error) {
      throw toModelError(error);
    }
  }

  // model: appelle le legacy pour télécharger le CSV d'un scrapper
  static async downloadScrapper(id, name) {
    try {
      const rawName = name || `scrapper_${id}`;
      const response = await axios.get(`${scraperBaseUrl}/download/${id}/${encodeURIComponent(rawName)}`, {
        auth: scraperAuth,
        responseType: 'arraybuffer',
        timeout: 120000,
      });

      return {
        data: response.data,
        headers: {
          contentType: response.headers['content-type'] || 'text/csv; charset=utf-8',
          contentDisposition: response.headers['content-disposition'] || `attachment; filename="${rawName}.csv"`,
        },
      };
    } catch (error) {
      throw toModelError(error);
    }
  }
}
