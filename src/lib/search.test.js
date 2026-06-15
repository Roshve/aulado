import { describe, it, expect } from 'vitest';
import { normalizarQuery, crearBuscador, buscar, filtrarLugares, segmentarResaltado } from './search.js';

// Datos mínimos de campus para las pruebas
const LUGARES = [
  {
    id: 'a-101', nombre: 'Aula 101', tipo: 'aula', sinonimos: ['a101', 'salon 101'],
    pisoNumero: 1, pisoEtiqueta: '1er Piso', planoPiso: '/planos/p1.png',
    edificioId: 'edif-a', edificioNombre: 'Edificio A', edificioApodos: ['a', 'alpha'],
    edificioEntrada: { lat: -34.6, lng: -58.3 }, edificioPisos: [],
  },
  {
    id: 'bano-pb', nombre: 'Baño Planta Baja', tipo: 'bano', sinonimos: ['wc', 'toilette'],
    pisoNumero: 0, pisoEtiqueta: 'Planta Baja', planoPiso: '/planos/pb.png',
    edificioId: 'edif-a', edificioNombre: 'Edificio A', edificioApodos: ['a'],
    edificioEntrada: { lat: -34.6, lng: -58.3 }, edificioPisos: [],
  },
  {
    id: 'lab-01', nombre: 'Laboratorio 01', tipo: 'laboratorio', sinonimos: ['lab01'],
    pisoNumero: 2, pisoEtiqueta: '2do Piso', planoPiso: '/planos/p2.png',
    edificioId: 'edif-b', edificioNombre: 'Edificio B', edificioApodos: ['b', 'beta'],
    edificioEntrada: { lat: -34.6, lng: -58.3 }, edificioPisos: [],
  },
];

describe('normalizarQuery', () => {
  it('convierte a minúsculas', () => {
    expect(normalizarQuery('AULA')).toBe('aula');
  });
  it('elimina diacríticos', () => {
    expect(normalizarQuery('baño')).toBe('bano');
    expect(normalizarQuery('Almacén')).toBe('almacen');
  });
  it('maneja string vacío', () => {
    expect(normalizarQuery('')).toBe('');
  });
});

describe('buscar', () => {
  const fuse = crearBuscador(LUGARES);

  it('devuelve vacío cuando el query está vacío y no hay filtros', () => {
    const r = buscar(fuse, '', LUGARES);
    expect(r).toHaveLength(0);
  });

  it('encuentra por nombre exacto', () => {
    const r = buscar(fuse, 'Aula 101', LUGARES);
    expect(r[0].id).toBe('a-101');
  });

  it('encuentra por sinónimo', () => {
    const r = buscar(fuse, 'a101', LUGARES);
    expect(r[0].id).toBe('a-101');
  });

  it('encuentra ignorando acentos', () => {
    const r = buscar(fuse, 'bano', LUGARES);
    expect(r.some((l) => l.id === 'bano-pb')).toBe(true);
  });

  it('devuelve array vacío si no hay match', () => {
    const r = buscar(fuse, 'xyzxyz', LUGARES);
    expect(r).toHaveLength(0);
  });

  it('busca por tipo', () => {
    const r = buscar(fuse, 'laboratorio', LUGARES);
    expect(r.some((l) => l.tipo === 'laboratorio')).toBe(true);
  });
});

describe('filtrarLugares', () => {
  const fuse = crearBuscador(LUGARES);

  it('devuelve vacío sin query ni filtros', () => {
    expect(filtrarLugares(fuse, '', LUGARES)).toHaveLength(0);
  });

  it('devuelve todos los lugares del tipo con filtro y sin query', () => {
    const r = filtrarLugares(fuse, '', LUGARES, ['bano']);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('bano-pb');
  });

  it('combina varios tipos con lógica OR', () => {
    const r = filtrarLugares(fuse, '', LUGARES, ['bano', 'laboratorio']);
    expect(r).toHaveLength(2);
    expect(r.map((l) => l.id).sort()).toEqual(['bano-pb', 'lab-01']);
  });

  it('refina por texto dentro del tipo filtrado', () => {
    const r = filtrarLugares(fuse, '101', LUGARES, ['aula']);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('a-101');
  });

  it('no devuelve resultados fuera del tipo filtrado', () => {
    const r = filtrarLugares(fuse, 'laboratorio', LUGARES, ['aula']);
    expect(r).toHaveLength(0);
  });
});

describe('segmentarResaltado', () => {
  it('devuelve un segmento sin highlight si el query está vacío', () => {
    expect(segmentarResaltado('Aula 101', '')).toEqual([
      { text: 'Aula 101', highlight: false },
    ]);
  });

  it('resalta coincidencia exacta', () => {
    expect(segmentarResaltado('Aula 101', '101')).toEqual([
      { text: 'Aula ', highlight: false },
      { text: '101', highlight: true },
    ]);
  });

  it('es insensible a acentos', () => {
    expect(segmentarResaltado('Baño PB', 'bano')).toEqual([
      { text: 'Baño', highlight: true },
      { text: ' PB', highlight: false },
    ]);
  });

  it('resalta múltiples ocurrencias', () => {
    expect(segmentarResaltado('Aula A', 'a')).toEqual([
      { text: 'A', highlight: true },
      { text: 'ul', highlight: false },
      { text: 'a', highlight: true },
      { text: ' ', highlight: false },
      { text: 'A', highlight: true },
    ]);
  });

  it('devuelve texto sin highlight si no hay match', () => {
    expect(segmentarResaltado('Laboratorio 01', 'xyz')).toEqual([
      { text: 'Laboratorio 01', highlight: false },
    ]);
  });
});
