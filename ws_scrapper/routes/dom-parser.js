const cheerio = require('cheerio');
const { epur, normalizeImageSrc } = require('./text-utils');

const IMAGE_ATTRS = ['src', 'data-src', 'data-lazy-src', 'data-original', 'srcset'];

/**
 * Extrait une valeur depuis le DOM selon un descriptor :
 *   - string                              → texte du premier élément trouvé
 *   - [listSelector, fieldMap]            → tableau d'objets (liste de produits)
 *   - { selector, scrape: [method, param] } → attribut ou texte ciblé
 */
const extract = ($, descriptor) => {
  if (descriptor == null) return null;

  try {
    if (typeof descriptor === 'string') {
      return epur($(descriptor).first().text());
    }

    if (Array.isArray(descriptor)) {
      const [listSelector, fieldMap] = descriptor;
      return $(listSelector)
        .map((_, el) => parseFields(cheerio.load(el), fieldMap))
        .get();
    }

    const { selector, scrape } = descriptor;
    if (!selector || !Array.isArray(scrape) || !scrape.length) return null;
    const [method, param] = scrape;
    return readAttr($, selector, method, param);
  } catch (err) {
    console.warn('[dom-parser] ⚠️  sélecteur invalide:', JSON.stringify(descriptor), '→', err.message);
    return null;
  }
};

/**
 * Lit un attribut ou texte depuis un sélecteur.
 * Pour src/srcset, tente une résolution intelligente avec fallback sur les enfants.
 */
const readAttr = ($, selector, method, param) => {
  if (method === 'attr') {
    return param === 'src' || param === 'srcset' ? resolveImage($, selector) : epur($(selector).first().attr(param));
  }
  if (method === 'text') {
    return epur($(selector).first().text());
  }
  // fallback générique (ex: method = 'html')
  const el = $(selector).first();
  return el.length && typeof el[method] === 'function' ? epur(el[method](param)) : null;
};

/**
 * Cherche une image dans les attributs connus, avec fallback progressif :
 * sélecteur → img enfant → source enfant → première img du document.
 */
const resolveImage = ($, selector) => {
  for (const target of [selector, `${selector} img`, `${selector} source`, 'img']) {
    const el = $(target).first();
    if (!el.length) continue;

    for (const attr of IMAGE_ATTRS) {
      const val = normalizeImageSrc(el.attr(attr));
      if (val) return val;
    }

    const match = (el.attr('style') || '').match(/url\(['"]?(.+?)['"]?\)/i);
    if (match?.[1]) return epur(match[1]);
  }
  return null;
};

/**
 * Construit un objet depuis un fieldMap { clé: descriptor }.
 */
const parseFields = ($, fieldMap) => {
  if (!fieldMap || typeof fieldMap !== 'object') return {};
  return Object.fromEntries(Object.entries(fieldMap).map(([key, descriptor]) => [key, extract($, descriptor)]));
};

module.exports = { parseFields, extract };
