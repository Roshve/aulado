import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getParadasIds,
  getParadas,
  esParada,
  agregarParada,
  quitarParada,
  limpiarParadas,
  resolverParadas,
} from './stops.js';

const LUGARES = [
  { id: 'a-101', nombre: 'Aula 101', tipo: 'aula' },
  { id: 'bano-pb', nombre: 'Baño Planta Baja', tipo: 'bano' },
  { id: 'cafe-1', nombre: 'Cafetería Central', tipo: 'cafeteria' },
];

const store = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
});

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

describe('getParadasIds', () => {
  it('devuelve [] cuando no hay datos', () => {
    expect(getParadasIds()).toEqual([]);
  });

  it('devuelve los IDs guardados', () => {
    store['aulado:paradas'] = JSON.stringify(['a-101', 'bano-pb']);
    expect(getParadasIds()).toEqual(['a-101', 'bano-pb']);
  });
});

describe('esParada', () => {
  it('retorna false si el ID no está', () => {
    expect(esParada('a-101')).toBe(false);
  });

  it('retorna true si el ID está guardado', () => {
    store['aulado:paradas'] = JSON.stringify(['a-101']);
    expect(esParada('a-101')).toBe(true);
  });
});

describe('agregarParada', () => {
  it('agrega un ID al final', () => {
    agregarParada('a-101', LUGARES);
    expect(getParadasIds()).toEqual(['a-101']);
  });

  it('no duplica IDs', () => {
    agregarParada('a-101', LUGARES);
    agregarParada('a-101', LUGARES);
    expect(getParadasIds()).toEqual(['a-101']);
  });

  it('agrega múltiples IDs en orden', () => {
    agregarParada('a-101', LUGARES);
    agregarParada('bano-pb', LUGARES);
    expect(getParadasIds()).toEqual(['a-101', 'bano-pb']);
  });

  it('devuelve la lista resuelta de objetos', () => {
    const result = agregarParada('a-101', LUGARES);
    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe('Aula 101');
  });
});

describe('quitarParada', () => {
  it('quita un ID existente', () => {
    store['aulado:paradas'] = JSON.stringify(['a-101', 'bano-pb']);
    quitarParada('a-101', LUGARES);
    expect(getParadasIds()).toEqual(['bano-pb']);
  });

  it('no falla si el ID no existe', () => {
    store['aulado:paradas'] = JSON.stringify(['a-101']);
    quitarParada('no-existe', LUGARES);
    expect(getParadasIds()).toEqual(['a-101']);
  });

  it('devuelve la lista actualizada', () => {
    store['aulado:paradas'] = JSON.stringify(['a-101', 'bano-pb']);
    const result = quitarParada('a-101', LUGARES);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('bano-pb');
  });
});

describe('limpiarParadas', () => {
  it('elimina todas las paradas', () => {
    store['aulado:paradas'] = JSON.stringify(['a-101', 'bano-pb']);
    limpiarParadas();
    expect(getParadasIds()).toEqual([]);
  });
});

describe('getParadas', () => {
  it('devuelve objetos resueltos', () => {
    store['aulado:paradas'] = JSON.stringify(['a-101', 'cafe-1']);
    const result = getParadas(LUGARES);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a-101');
    expect(result[1].id).toBe('cafe-1');
  });

  it('descarta IDs que no existen en todosLugares', () => {
    store['aulado:paradas'] = JSON.stringify(['a-101', 'no-existe']);
    const result = getParadas(LUGARES);
    expect(result).toHaveLength(1);
  });
});

describe('resolverParadas', () => {
  it('preserva el orden de los IDs', () => {
    const result = resolverParadas(['cafe-1', 'a-101'], LUGARES);
    expect(result[0].id).toBe('cafe-1');
    expect(result[1].id).toBe('a-101');
  });
});
