import { describe, it, expect } from 'vitest';

const cheerio = require('cheerio');
const { extract, parseFields } = require('../../routes/dom-parser');

const load = (html) => cheerio.load(html);

describe('extract', () => {
  it('retourne null pour un descripteur absent', () => {
    expect(extract(load('<p>x</p>'), null)).toBeNull();
    expect(extract(load('<p>x</p>'), undefined)).toBeNull();
  });

  it('chaîne : texte nettoyé du premier élément trouvé', () => {
    const $ = load('<h1>  Cave   des  Amis </h1><h1>Autre</h1>');
    expect(extract($, 'h1')).toBe('Cave des Amis');
  });

  it('chaîne : null si le sélecteur ne trouve rien', () => {
    expect(extract(load('<p>x</p>'), '.absent')).toBeNull();
  });

  it('tableau : liste d’objets par élément', () => {
    const $ = load(`
      <div class="p"><b>A</b><i>10 €</i></div>
      <div class="p"><b>B</b><i>12 €</i></div>`);
    expect(extract($, ['.p', { cuvee: 'b', prix: 'i' }])).toEqual([
      { cuvee: 'A', prix: '10 €' },
      { cuvee: 'B', prix: '12 €' },
    ]);
  });

  it('objet attr : lit un attribut', () => {
    const $ = load('<a class="l" href="/vin/1">Vin</a>');
    expect(extract($, { selector: '.l', scrape: ['attr', 'href'] })).toBe('/vin/1');
  });

  it('objet text : lit le texte', () => {
    const $ = load('<span class="s"> En stock </span>');
    expect(extract($, { selector: '.s', scrape: ['text'] })).toBe('En stock');
  });

  it('objet avec méthode générique (html)', () => {
    const $ = load('<div class="d"><b>gras</b></div>');
    expect(extract($, { selector: '.d', scrape: ['html'] })).toBe('<b>gras</b>');
  });

  it('objet incomplet : null', () => {
    const $ = load('<p>x</p>');
    expect(extract($, { selector: 'p' })).toBeNull();
    expect(extract($, { scrape: ['text'] })).toBeNull();
    expect(extract($, { selector: 'p', scrape: [] })).toBeNull();
  });

  it('sélecteur invalide : null sans lever d’erreur', () => {
    expect(extract(load('<p>x</p>'), 'p[')).toBeNull();
  });

  describe('résolution d’image (attr src/srcset)', () => {
    const img = (html) => extract(load(html), { selector: '.pic', scrape: ['attr', 'src'] });

    it('lit src directement', () => {
      expect(img('<img class="pic" src="/a.jpg">')).toBe('/a.jpg');
    });

    it('se rabat sur data-src (lazy-loading)', () => {
      expect(img('<img class="pic" data-src="/lazy.jpg">')).toBe('/lazy.jpg');
    });

    it('prend la première URL d’un srcset', () => {
      expect(img('<img class="pic" srcset="/s.jpg 1x, /l.jpg 2x">')).toBe('/s.jpg');
    });

    it('cherche l’img enfant du sélecteur', () => {
      expect(img('<div class="pic"><img src="/child.jpg"></div>')).toBe('/child.jpg');
    });

    it('cherche la balise source enfant', () => {
      expect(img('<picture class="pic"><source srcset="/src.webp 1x"></picture>')).toBe('/src.webp');
    });

    it('lit une image en background-image', () => {
      expect(img(`<div class="pic" style="background-image: url('/bg.jpg')"></div>`)).toBe('/bg.jpg');
    });

    it('en dernier recours, prend la première img du fragment', () => {
      expect(img('<span class="pic"></span><img src="/first.jpg">')).toBe('/first.jpg');
    });

    it('null si aucune image', () => {
      expect(img('<span class="pic"></span>')).toBeNull();
    });
  });
});

describe('parseFields', () => {
  it('construit un objet depuis le fieldMap', () => {
    const $ = load('<h1>Cave</h1><a href="/x">lien</a>');
    expect(parseFields($, { titre: 'h1', url: { selector: 'a', scrape: ['attr', 'href'] }, vide: '.absent' })).toEqual({
      titre: 'Cave',
      url: '/x',
      vide: null,
    });
  });

  it('retourne un objet vide pour un fieldMap invalide', () => {
    expect(parseFields(load('<p></p>'), null)).toEqual({});
    expect(parseFields(load('<p></p>'), 'h1')).toEqual({});
  });
});
