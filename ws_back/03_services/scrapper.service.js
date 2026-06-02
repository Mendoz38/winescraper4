const { randomUUID } = require("node:crypto");
const { query } = require("../00_utils/db");
const { toScrapperDto } = require("../02_models/scrapper.model");

const baseSelect = `
  SELECT
    id,
    boutique_id,
    thecat,
    a_scraper,
    hour_cron,
    day_cron,
    urls,
    mode,
    pagination,
    load_more,
    item_selector,
    sel_domaine,
    sel_cuvee,
    sel_prix,
    sel_stock,
    sel_image,
    sel_link,
    sel_category,
    last_run,
    active,
    created_at,
    updated_at
  FROM com_scrapper
`;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toNullable(value) {
  if (value === undefined || value === null || value === "") return null;
  return value;
}

function toBoolFlag(value, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value === 1 ? 1 : 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "oui") return 1;
    return 0;
  }
  return fallback;
}

function parseJsonInput(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return fallback;
    }
  }
  return fallback;
}

function mapBodyToDbPayload(body = {}) {
  const scrapeData = parseJsonInput(body.scrapeData, {}) || {};
  const scrapeBlock = parseJsonInput(scrapeData.data, {}) || {};
  const csv = Array.isArray(scrapeBlock.csv) ? scrapeBlock.csv : [];
  const itemSelector = typeof csv[0] === "string" ? csv[0] : null;
  const fields = csv[1] && typeof csv[1] === "object" ? csv[1] : {};
  const urls = parseJsonInput(body.urls, null) || parseJsonInput(scrapeData.url, null) || [];

  return {
    boutique_id: toNullable(body.boutique_id),
    thecat: toNullable(body.thecat),
    a_scraper: toBoolFlag(body.a_scraper, 0),
    hour_cron: toNullable(body.hour_cron ?? scrapeData.hour_cron),
    day_cron: toNullable(body.day_cron ?? scrapeData.day_cron),
    urls: JSON.stringify(Array.isArray(urls) ? urls : []),
    mode: toNullable(body.mode ?? scrapeData.mode),
    pagination: toNullable(body.pagination ?? scrapeData.pagination),
    load_more: toNullable(body.load_more ?? scrapeData.load_more),
    item_selector: toNullable(body.item_selector ?? itemSelector),
    sel_domaine: toNullable(body.sel_domaine ?? fields.domaine),
    sel_cuvee: toNullable(body.sel_cuvee ?? fields.cuvee),
    sel_prix: toNullable(body.sel_prix ?? fields.prix ?? fields.price),
    sel_stock: toNullable(body.sel_stock ?? fields.stock),
    sel_image: JSON.stringify(parseJsonInput(body.sel_image, null) ?? parseJsonInput(fields.image, null)),
    sel_link: JSON.stringify(parseJsonInput(body.sel_link, null) ?? parseJsonInput(fields.link, null) ?? parseJsonInput(fields.url, null)),
    sel_category: JSON.stringify(parseJsonInput(body.sel_category, null) ?? parseJsonInput(scrapeBlock.category, null)),
    active: toBoolFlag(body.active, 1),
  };
}

async function findOneRaw(id) {
  const rows = await query(`${baseSelect} WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

async function listScrappers({ activeOnly = false } = {}) {
  const sql = activeOnly
    ? `${baseSelect} WHERE active = 1 ORDER BY id`
    : `${baseSelect} ORDER BY id`;
  const rows = await query(sql);
  return rows.map(toScrapperDto);
}

async function getScrapper(id) {
  const row = await findOneRaw(id);
  if (!row) {
    throw createHttpError(404, "scrapper not found");
  }
  return toScrapperDto(row);
}

async function createScrapper(body) {
  const id = body.id || randomUUID();
  const payload = mapBodyToDbPayload(body);

  await query(
    `
    INSERT INTO com_scrapper (
      id, boutique_id, thecat, a_scraper, hour_cron, day_cron, urls,
      mode, pagination, load_more, item_selector, sel_domaine, sel_cuvee,
      sel_prix, sel_stock, sel_image, sel_link, sel_category, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      payload.boutique_id,
      payload.thecat,
      payload.a_scraper,
      payload.hour_cron,
      payload.day_cron,
      payload.urls,
      payload.mode,
      payload.pagination,
      payload.load_more,
      payload.item_selector,
      payload.sel_domaine,
      payload.sel_cuvee,
      payload.sel_prix,
      payload.sel_stock,
      payload.sel_image,
      payload.sel_link,
      payload.sel_category,
      payload.active,
    ]
  );

  return getScrapper(id);
}


async function touchLastRun(id) {
  await query(`UPDATE com_scrapper SET last_run = NOW() WHERE id = ?`, [id]);
}

module.exports = {
  listScrappers,
  getScrapper,
  createScrapper,
  updateScrapper,
  touchLastRun,
};
