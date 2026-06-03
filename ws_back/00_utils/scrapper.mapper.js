// helper: parse un JSON stocké en base (ou retourne fallback)
function safeParseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

// helper: convertit un flag SQL 0/1 en booléen
function normalizeBooleanFlag(value) {
  return Number(value) === 1;
}

// helper: reconstruit le bloc scrapeData attendu par le front/legacy
function toLegacyScrapeData(row) {
  return {
    url: safeParseJson(row.urls, []),
    day_cron: row.day_cron,
    hour_cron: row.hour_cron,
    mode: row.mode,
    pagination: row.pagination,
    load_more: row.load_more,
    data: {
      category: safeParseJson(row.sel_category, null),
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
  };
}

// helper: transforme une ligne SQL brute en DTO de scrapper
function toScrapperDto(row) {
  return {
    id: row.id,
    boutique_id: row.boutique_id,
    nom_boutique: row.nom_boutique ?? null,
    en_ligne: row.en_ligne === null || row.en_ligne === undefined ? null : normalizeBooleanFlag(row.en_ligne),
    payant: row.payant === null || row.payant === undefined ? null : normalizeBooleanFlag(row.payant),
    retrait: row.retrait === null || row.retrait === undefined ? null : normalizeBooleanFlag(row.retrait),
    thecat: row.thecat,
    niveau: row.niveau,
    a_scraper: normalizeBooleanFlag(row.a_scraper),
    active: normalizeBooleanFlag(row.active),
    day_cron: row.day_cron,
    hour_cron: row.hour_cron,
    mode: row.mode,
    pagination: row.pagination,
    load_more: row.load_more,
    last_run: row.last_run,
    created_at: row.created_at,
    updated_at: row.updated_at,
    scrapeData: toLegacyScrapeData(row),
  };
}

module.exports = {
  toScrapperDto,
};
