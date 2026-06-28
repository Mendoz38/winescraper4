let db;

module.exports = (_db) => {
  db = _db;
  return VigneronsModel;
};

class VigneronsModel {
  //--------- SELECT dénomination VIGNERONS ------------//
  static async getVigneronsSite() {
    return db.query(`
      SELECT
        domaine,
        dom_commerce,
        dom_commerce2
      FROM vn_viticulteur
      ORDER BY domaine
    `);
  }
}
