let db;

module.exports = (_db) => {
  db = _db;
  return BoutiqueModel;
};

const toStr = (v) => (v == null ? '' : String(v).trim());

const BATCH_SIZE = 500;

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

    const connection = await db.pool.getConnection();
    try {
      await connection.beginTransaction();

      // Supprime toutes les lignes existantes pour cette boutique
      await connection.execute('DELETE FROM com_aaa WHERE boutique = ?', [boutiqueName]);

      // Insert par chunks de BATCH_SIZE pour éviter max_allowed_packet
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const values = chunk.map((row) => [
          toStr(row?.domaine),
          toStr(row?.cuvee),
          toStr(row?.prix),
          toStr(row?.image),
          toStr(row?.link || row?.url),
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
      const [stockDelete] = await connection.execute(`DELETE FROM com_aaa WHERE boutique = ? AND TRIM(stock) = '0'`, [boutiqueName]);

      await connection.commit();

      return {
        boutique: boutiqueName,
        inserted: rows.length,
        removedEmptyPrice: emptyPriceDelete?.affectedRows || 0,
        removedOutOfStock: stockDelete?.affectedRows || 0,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
