/**
 * Trim agressif : supprime espaces, tabs, newlines en début/fin,
 * puis collapse les espaces internes.
 */
const epur = (str) => {
  if (str === null || str === undefined) return str;
  if (typeof str !== 'string') return str;
  str = str.trim().replace(/[\r\n\t]+/g, ' ');
  while (str.includes('  ')) str = str.replace(/  +/g, ' ');
  return str || null;
};

/**
 * Normalise une valeur d'attribut image (srcset → première URL).
 */
const normalizeImageSrc = (value) => {
  const v = epur(value);
  if (!v) return null;
  // srcset "url1 1x, url2 2x" → première url
  if (v.includes(',')) return epur(v.split(',')[0].split(' ')[0]);
  // "url 2x" → url seule
  if (v.includes(' ') && /^https?:\/\//i.test(v)) return epur(v.split(' ')[0]);
  return v;
};

module.exports = { epur, normalizeImageSrc };
