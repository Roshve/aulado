import { describe, it, expect } from 'vitest';
import { normalizarQuery, crearBuscador, buscar } from './search.js';

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

  it('devuelve todos cuando el query está vacío', () => {
    const r = buscar(fuse, '', LUGARES);
    expect(r).toHaveLength(LUGARES.length);
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
