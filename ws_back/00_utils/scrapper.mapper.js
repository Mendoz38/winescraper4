// helper: parse un JSON stocké en base (ou retourne fallback)
const safeParseJson = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// helper: convertit un flag SQL 0/1 en booléen
const nullableBool = (value) => (value == null ? null : Number(value) === 1);

// helper: reconstruit le bloc scrapeData attendu par le front/legacy
const toLegacyScrapeData = (row) => ({
  url: safeParseJson(row.urls, []),
  day_cron: row.day_cron,
  hour_cron: row.hour_cron,
  mode: row.mode,
  pagination: row.pagination,
  load_more: row.load_more,
  data: {
    category: row.sel_category ?? null,
    csv: [
      row.item_selector,
      {
        domaine: row.sel_domaine,
        cuvee: row.sel_cuvee,
        prix: row.sel_prix,
        stock: row.sel_stock,
        image: safeParseJson(row.sel_image, null),
        link: safeParseJson(row.sel_link, null),
      },
    ],
  },
});

// helper: transforme une ligne SQL brute en DTO de scrapper
const toScrapperDto = (row) => ({
  id: row.id,
  rss: row.rss ?? null,
  boutique_id: row.boutique_id,
  nom_boutique: row.nom_boutique ?? null,
  image: row.image ?? null,
  img_boutique: row.image ?? null,
  height_image: row.height_image ?? null,
  langue: row.langue ?? null,
  pays: row.langue ?? null,
  monnaie: row.monnaie ?? null,
  retrait_db: row.retrait ?? null,
  en_ligne: nullableBool(row.en_ligne),
  payant: nullableBool(row.payant),
  retrait: nullableBool(row.retrait),
  thecat: row.thecat,
  niveau: row.boutique_niveau ?? null,
  scrapper_niveau: row.niveau,
  a_scraper: Number(row.a_scraper) === 1,
  active: Number(row.active) === 1,
  day_cron: row.day_cron,
  hour_cron: row.hour_cron,
  mode: row.mode,
  pagination: row.pagination,
  load_more: row.load_more,
  last_run: row.last_run,
  created_at: row.created_at,
  updated_at: row.updated_at,
  scrapeData: toLegacyScrapeData(row),
});

module.exports = {
  toScrapperDto,
};
