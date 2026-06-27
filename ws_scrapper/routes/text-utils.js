/**
 * Trim agressif : supprime whitespace en début/fin, collapse les espaces internes.
 * Retourne null si la chaîne est vide.
 */
const epur = (str) => {
  if (str == null || typeof str !== 'string') return str ?? null;
  const cleaned = str
    .trim()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ');
  return cleaned || null;
};

/**
 * Normalise un attribut image : srcset "url1 1x, url2 2x" → première URL.
 */
const normalizeImageSrc = (value) => {
  const v = epur(value);
  if (!v) return null;
  // Ne traiter comme srcset que si un descripteur (1x, 2x, 300w...) est présent.
  // Évite de tronquer les URLs (ex: Wix) qui contiennent des virgules dans le chemin.
  if (/\s\d+(\.\d+)?[wx](,|$)/i.test(v)) {
    const match = v.match(/^(.*?)\s\d+(\.\d+)?[wx]/i);
    if (match?.[1]) return epur(match[1]);
  }
  if (v.includes(' ') && /^https?:\/\//i.test(v)) return epur(v.split(' ')[0]);
  return v;
};

module.exports = { epur, normalizeImageSrc };
