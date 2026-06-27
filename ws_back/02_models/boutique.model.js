let db;

module.exports = (_db) => {
  db = _db;
  return BoutiqueModel;
};

const toStr = (v) => (v == null ? '' : String(v).trim());

/**
 * Vérifie si un domaine scrappé correspond à l'un des vignerons du site (recherche partielle LIKE).
 * @param {string} domaineRow Domaine de la ligne scrappée
 * @param {Array} vignerons Liste des vignerons avec domaine, dom_commerce, dom_commerce2
 * @returns {boolean}
 */
const isVigneronFromSite = (domaineRow, vignerons) => {
  const rowLower = toStr(domaineRow).toLowerCase();
  return vignerons.some((v) => {
    const domLower = toStr(v.domaine).toLowerCase();
    const com1Lower = toStr(v.dom_commerce).toLowerCase();
    const com2Lower = toStr(v.dom_commerce2).toLowerCase();
    return (
      rowLower.includes(domLower) ||
      rowLower.includes(com1Lower) ||
      rowLower.includes(com2Lower) ||
      domLower.includes(rowLower) ||
      com1Lower.includes(rowLower) ||
      com2Lower.includes(rowLower)
    );
  });
};

/**
 * Préfixe une URL relative avec une base (add_url / add_url_image).
 * Si l'URL est déjà absolue (http, https, data, //), elle est conservée.
 * @param {unknown} value URL brute extraite du scrape
 * @param {string} base Préfixe à ajouter
 * @returns {string}
 */
const prependBaseUrl = (value, base) => {
  const rawValue = toStr(value);
  const rawBase = toStr(base);

  if (!rawValue) return '';
  if (!rawBase) return rawValue;
  if (/^(https?:)?\/\//i.test(rawValue) || rawValue.startsWith('data:')) return rawValue;

  const cleanBase = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
  const cleanValue = rawValue.startsWith('/') ? rawValue.slice(1) : rawValue;
  return `${cleanBase}/${cleanValue}`;
};

const BATCH_SIZE = 500;
// Mettre à false pour désactiver le filtre vignerons
const ENABLE_VIGNERON_FILTER = true;

class BoutiqueModel {
  //--------- UPSERT boutiques rows ------------//
  static async replaceBoutiqueRows({ boutique, rows = [], meta = {} }) {
    const boutiqueName = toStr(boutique || meta.nom_boutique);
    if (!boutiqueName) {
      const e = new Error('boutique manquante');
      e.status = 400;
      throw e;
    }
    if (!Array.isArray(rows)) {
      const e = new Error('rows doit être un tableau');
      e.status = 400;
      throw e;
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const batchId = String(Math.floor(Math.random() * 1_000_000_000));
    const imgBoutique = toStr(meta.img_boutique || meta.image);
    const pays = toStr(meta.pays || meta.langue);
    const imgHeight = toStr(meta.height_image);
    const retrait = toStr(meta.retrait_db ?? meta.retrait);
    const niveau = toStr(meta.niveau);
    const monnaie = toStr(meta.monnaie);
    const addUrlImage = toStr(meta.add_url_image);
    const addUrl = toStr(meta.add_url);

    const connection = await db.pool.getConnection();
    try {
      await connection.beginTransaction();

      // Récupère les vignerons présents sur le site
      const vignerons = await db.query(`
        SELECT domaine, dom_commerce, dom_commerce2 FROM vn_viticulteur
      `);

      // Filtre les lignes : garder uniquement celles avec un domaine du site
      const filteredRows = ENABLE_VIGNERON_FILTER ? rows.filter((row) => isVigneronFromSite(row?.domaine, vignerons)) : rows;

      // Supprime toutes les lignes existantes pour cette boutique
      await connection.execute('DELETE FROM com_aaa WHERE boutique = ?', [boutiqueName]);

      // Insert par chunks de BATCH_SIZE pour éviter max_allowed_packet
      for (let i = 0; i < filteredRows.length; i += BATCH_SIZE) {
        const chunk = filteredRows.slice(i, i + BATCH_SIZE);
        const values = chunk.map((row) => [
          toStr(row?.domaine),
          toStr(row?.cuvee),
          toStr(row?.prix),
          prependBaseUrl(row?.image, addUrlImage),
          prependBaseUrl(row?.link || row?.url, addUrl),
          toStr(row?.stock),
          boutiqueName,
          imgBoutique,
          pays,
          imgHeight,
          retrait,
          niveau,
          nowUnix,
          batchId,
          monnaie,
        ]);
        const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
        await connection.execute(
          `INSERT INTO com_aaa (domaine,cuvee,ttc,image,url,stock,boutique,img_boutique,pays,img_height,retrait,niveau,maj,jok01,monnaie) VALUES ${placeholders}`,
          values.flat()
        );
      }

      // Supprime les lignes sans prix valide
      const [emptyPriceDelete] = await connection.execute(
        `DELETE FROM com_aaa WHERE boutique = ? AND (ttc IS NULL OR TRIM(ttc) = '' OR LOWER(TRIM(ttc)) = 'price')`,
        [boutiqueName]
      );

      // Supprime les lignes hors stock
      // const [stockDelete] = await connection.execute(`DELETE FROM com_aaa WHERE boutique = ? AND TRIM(stock) = '0'`, [boutiqueName]);

      // Met à jour la date de mise à jour de la boutique
      await connection.execute(`UPDATE com_boutiques SET maj = ? WHERE nom_boutique = ?`, [nowUnix, boutiqueName]);

      await connection.commit();

      return {
        boutique: boutiqueName,
        inserted: filteredRows.length,
        filteredOut: rows.length - filteredRows.length,
        removedEmptyPrice: emptyPriceDelete?.affectedRows || 0,
        // removedOutOfStock: stockDelete?.affectedRows || 0,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
