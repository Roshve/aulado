import { describe, it, expect } from 'vitest';
import { parseSearchParams, serializeSearch } from './urlState.js';

describe('serializeSearch', () => {
  it('devuelve "" cuando todo está vacío', () => {
    expect(serializeSearch('', [])).toBe('');
  });

  it('serializa solo el query', () => {
    expect(serializeSearch('aula', [])).toBe('?q=aula');
  });

  it('serializa solo los tipos', () => {
    const result = serializeSearch('', ['aula', 'bano']);
    expect(result).toContain('tipos=');
    // round-trip: lo que serializa, lo parsea igual
    expect(parseSearchParams(result)).toEqual({ q: '', tipos: ['aula', 'bano'] });
  });

  it('serializa query y tipos juntos', () => {
    const result = serializeSearch('s-01', ['aula']);
    expect(result).toContain('q=s-01');
    expect(result).toContain('tipos=');
    expect(parseSearchParams(result)).toEqual({ q: 's-01', tipos: ['aula'] });
  });

  it('ignora query con solo espacios', () => {
    expect(serializeSearch('   ', [])).toBe('');
  });

  it('recorta espacios del query', () => {
    expect(serializeSearch('  aula  ', [])).toBe('?q=aula');
  });
});

describe('parseSearchParams', () => {
  it('devuelve valores vacíos si no hay params', () => {
    expect(parseSearchParams('')).toEqual({ q: '', tipos: [] });
  });

  it('parsea solo el query', () => {
    expect(parseSearchParams('?q=cafeteria')).toEqual({ q: 'cafeteria', tipos: [] });
  });

  it('parsea solo los tipos', () => {
    const s = serializeSearch('', ['aula', 'bano']);
    expect(parseSearchParams(s)).toEqual({ q: '', tipos: ['aula', 'bano'] });
  });

  it('parsea query y tipos', () => {
    const s = serializeSearch('s-01', ['aula', 'laboratorio']);
    expect(parseSearchParams(s)).toEqual({ q: 's-01', tipos: ['aula', 'laboratorio'] });
  });

  it('round-trip con múltiples tipos', () => {
    const q = 'laboratorio';
    const tipos = ['laboratorio', 'oficina', 'biblioteca'];
    expect(parseSearchParams(serializeSearch(q, tipos))).toEqual({ q, tipos });
  });

  it('tolera string sin ?', () => {
    expect(parseSearchParams('q=aula').q).toBe('aula');
  });
});
