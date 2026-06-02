const cheerio = require('cheerio');
const { epur, normalizeImageSrc } = require('./text-utils');

const IMAGE_ATTRS = ['src', 'data-src', 'data-lazy-src', 'data-original', 'srcset'];

/**
 * Lit une valeur depuis le DOM selon un descriptor :
 *  - string         → text du sélecteur
 *  - { selector, scrape: [attr, param] } → attribut ou text
 *  - [selector, fieldMap] → liste d'objets
 */
const extract = ($, descriptor) => {
  if (descriptor === null || descriptor === undefined) return null;

  if (typeof descriptor === 'string') {
    return epur($(descriptor).first().text());
  }

  if (Array.isArray(descriptor)) {
    const [listSelector, fieldMap] = descriptor;
    return $(listSelector)
      .map((_, el) => parseFields(cheerio.load(el), fieldMap))
      .get();
  }

  // object form: { selector, scrape: [method, param] }
  const { selector, scrape } = descriptor;
  if (!selector || !Array.isArray(scrape) || scrape.length === 0) return null;
  const [method, param] = scrape;
  return readAttr($, selector, method, param);
};

const readAttr = ($, selector, method, param) => {
  if (method === 'attr') {
    if (param === 'src' || param === 'srcset') {
      return resolveImage($, selector);
    }
    return epur($(selector).first().attr(param));
  }
  if (method === 'text') {
    return epur($(selector).first().text());
  }
  // fallback générique
  const target = $(selector).first();
  if (!target || typeof target[method] !== 'function') return null;
  return epur(target[method](param));
};

/**
 * Cherche une image dans les attributs connus, avec fallback sur les img enfants.
 */
const resolveImage = ($, selector) => {
  const targets = [selector, `${selector} img`, `${selector} source`, 'img'];

  for (const target of targets) {
    const el = $(target).first();
    if (!el.length) continue;

    for (const attr of IMAGE_ATTRS) {
      const val = normalizeImageSrc(el.attr(attr));
      if (val) return val;
    }

    // background-image CSS
    const style = el.attr('style') || '';
    const match = style.match(/url\(['"]?(.+?)['"]?\)/i);
    if (match && match[1]) return epur(match[1]);
  }

  return null;
};

/**
 * Construit un objet Row depuis un fieldMap { key: descriptor }.
 */
const parseFields = ($, fieldMap) => {
  const row = {};
  if (!fieldMap || typeof fieldMap !== 'object') return row;

  Object.keys(fieldMap).forEach((key) => {
    row[key] = extract($, fieldMap[key]);
  });
  return row;
};

module.exports = { parseFields, extract };
