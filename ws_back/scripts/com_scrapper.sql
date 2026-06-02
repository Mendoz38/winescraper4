-- ============================================================
-- TABLE : com_scrapper
-- Remplace le config.json pour le système de scraping
-- À lier à com_boutiques via boutique_id
-- ============================================================

CREATE TABLE `com_scrapper` (
    `id`              VARCHAR(36)     NOT NULL,           -- UUID repris du JSON
    `boutique_id`     INT             NULL,               -- FK vers com_boutiques (nullable pour migration progressive)

    -- --------------------------------------------------------
    -- Métadonnées
    -- --------------------------------------------------------
    `thecat`          VARCHAR(50)     NULL,               -- "V1", "Lazy", "Impossible", ...
    `a_scraper`       TINYINT(1)      NOT NULL DEFAULT 0, -- 1 = Oui, 0 = Non

    -- --------------------------------------------------------
    -- Planification CRON
    -- --------------------------------------------------------
    `hour_cron`       VARCHAR(10)     NULL,               -- ex: "4h48"
    `day_cron`        VARCHAR(20)     NULL,               -- ex: "Friday" (null = tous les jours)

    -- --------------------------------------------------------
    -- Configuration scraping
    -- --------------------------------------------------------
    `urls`            JSON            NOT NULL,           -- tableau d'URLs à scraper
    `mode`            VARCHAR(20)     NULL,               -- "lazy", "xlazy", null
    `pagination`      VARCHAR(255)    NULL,               -- sélecteur CSS bouton page suivante
    `load_more`       VARCHAR(255)    NULL,               -- sélecteur CSS bouton "voir plus"

    -- --------------------------------------------------------
    -- Sélecteurs CSS d'extraction
    -- --------------------------------------------------------
    `item_selector`   VARCHAR(255)    NULL,               -- conteneur produit, ex: ".product-item"

    `sel_domaine`     VARCHAR(255)    NULL,               -- sélecteur texte du domaine/producteur
    `sel_cuvee`       VARCHAR(255)    NULL,               -- sélecteur texte de la cuvée
    `sel_prix`        VARCHAR(255)    NULL,               -- sélecteur texte du prix
    `sel_stock`       VARCHAR(255)    NULL,               -- sélecteur texte du stock/dispo

    -- Sélecteurs complexes : {"selector": "...", "scrape": ["attr", "src"]}
    `sel_image`       JSON            NULL,
    `sel_link`        JSON            NULL,

    -- Sélecteur catégorie (utilisé principalement pour les vignerons)
    -- Peut être une string CSS simple ou un objet {"selector":"...", "scrape":["attr","alt"]}
    `sel_category`    JSON            NULL,

    -- --------------------------------------------------------
    -- Suivi d'exécution
    -- --------------------------------------------------------
    `last_run`        DATETIME        NULL,
    `active`          TINYINT(1)      NOT NULL DEFAULT 1, -- désactiver sans supprimer (CRONOFF)

    -- --------------------------------------------------------
    -- Timestamps
    -- --------------------------------------------------------
    `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME        NULL ON UPDATE CURRENT_TIMESTAMP,

    -- --------------------------------------------------------
    -- Contraintes
    -- --------------------------------------------------------
    PRIMARY KEY (`id`),
    KEY `idx_boutique_id`  (`boutique_id`),
    KEY `idx_active`       (`active`),
    KEY `idx_last_run`     (`last_run`),

    CONSTRAINT `fk_scrapper_boutique`
        FOREIGN KEY (`boutique_id`)
        REFERENCES `com_boutiques` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- NOTES SUR LA CORRESPONDANCE JSON → COLONNES
-- ============================================================
--
-- JSON                          → Colonne
-- -----------------------------------------
-- (clé UUID)                    → id
-- name                          → boutique_id (jointure com_boutiques)
-- thecat                        → thecat
-- a_scraper ("Oui"/"Non")       → a_scraper (1/0)
-- scrapeData.url                → urls (JSON array)
-- scrapeData.hour_cron          → hour_cron
-- scrapeData.day_cron           → day_cron
-- scrapeData.mode               → mode
-- scrapeData.pagination         → pagination
-- scrapeData.load_more          → load_more
-- scrapeData.data.csv[0]        → item_selector
-- scrapeData.data.csv[1].domaine  → sel_domaine
-- scrapeData.data.csv[1].cuvee    → sel_cuvee
-- scrapeData.data.csv[1].prix     → sel_prix  (ou "price")
-- scrapeData.data.csv[1].stock    → sel_stock
-- scrapeData.data.csv[1].image    → sel_image (JSON)
-- scrapeData.data.csv[1].link     → sel_link  (JSON) (ou "url")
-- scrapeData.data.category        → sel_category (JSON)
-- lastRun                       → last_run
-- (CRONOFF dans le name)        → active = 0
--
-- ============================================================
