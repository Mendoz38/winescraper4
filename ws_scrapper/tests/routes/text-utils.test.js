import { describe, it, expect } from 'vitest';

const { epur, normalizeImageSrc } = require('../../routes/text-utils');

describe('epur', () => {
  it('supprime les espaces en bord et réduit les espaces internes', () => {
    expect(epur('   Domaine   de   la Côte  ')).toBe('Domaine de la Côte');
  });

  it('remplace retours ligne et tabulations par un espace', () => {
    expect(epur('Cuvée\n\tRouge\r\nNature')).toBe('Cuvée Rouge Nature');
  });

  it('retourne null pour une chaîne vide ou blanche', () => {
    expect(epur('')).toBeNull();
    expect(epur('   \n ')).toBeNull();
  });

  it('retourne null pour null/undefined et laisse passer les non-chaînes', () => {
    expect(epur(null)).toBeNull();
    expect(epur(undefined)).toBeNull();
    expect(epur(12)).toBe(12);
  });
});

describe('normalizeImageSrc', () => {
  it('garde une URL simple telle quelle', () => {
    expect(normalizeImageSrc('https://shop.fr/img/vin.jpg')).toBe('https://shop.fr/img/vin.jpg');
  });

  it('prend la première URL d’un srcset avec descripteurs x', () => {
    expect(normalizeImageSrc('https://shop.fr/a.jpg 1x, https://shop.fr/b.jpg 2x')).toBe('https://shop.fr/a.jpg');
  });

  it('prend la première URL d’un srcset avec descripteurs w', () => {
    expect(normalizeImageSrc('/img/a-300.jpg 300w, /img/a-600.jpg 600w')).toBe('/img/a-300.jpg');
  });

  it('ne tronque pas une URL contenant des virgules sans descripteur (Wix)', () => {
    const wix = 'https://static.wixstatic.com/media/abc.jpg/v1/fill/w_200,h_300,al_c/abc.jpg';
    expect(normalizeImageSrc(wix)).toBe(wix);
  });

  it('coupe au premier espace une URL http suivie d’autre chose', () => {
    expect(normalizeImageSrc('https://shop.fr/a.jpg  lazy')).toBe('https://shop.fr/a.jpg');
  });

  it('retourne null pour une valeur vide', () => {
    expect(normalizeImageSrc('')).toBeNull();
    expect(normalizeImageSrc(undefined)).toBeNull();
  });
});
