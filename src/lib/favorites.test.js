import { describe, it, expect, beforeEach } from 'vitest';
import { getFavoritos, toggleFavorito, esFavorito } from './favorites.js';

// Vitest corre en Node; polyfill mínimo de localStorage
const store = {};
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};

beforeEach(() => {
  // Limpiar storage entre tests
  delete store['aulado:favoritos'];
});

describe('getFavoritos', () => {
  it('devuelve un Set vacío si no hay datos', () => {
    const f = getFavoritos();
    expect(f).toBeInstanceOf(Set);
    expect(f.size).toBe(0);
  });
});

describe('toggleFavorito', () => {
  it('agrega un lugar y devuelve true', () => {
    const r = toggleFavorito('a-101');
    expect(r).toBe(true);
    expect(esFavorito('a-101')).toBe(true);
  });

  it('quita un lugar ya favorito y devuelve false', () => {
    toggleFavorito('a-101');
    const r = toggleFavorito('a-101');
    expect(r).toBe(false);
    expect(esFavorito('a-101')).toBe(false);
  });

  it('persiste múltiples favoritos', () => {
    toggleFavorito('a-101');
    toggleFavorito('bano-pb');
    const f = getFavoritos();
    expect(f.has('a-101')).toBe(true);
    expect(f.has('bano-pb')).toBe(true);
  });
});

describe('esFavorito', () => {
  it('devuelve false para un id desconocido', () => {
    expect(esFavorito('no-existe')).toBe(false);
  });
});
