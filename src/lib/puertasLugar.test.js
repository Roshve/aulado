import { describe, it, expect } from 'vitest';
import {
  puertasDe,
  serializarPuertas,
  idNodoPuerta,
  etiquetaPuerta,
} from './puertasLugar.js';

describe('puertasLugar', () => {
  it('lee puerta singular', () => {
    expect(puertasDe({ puerta: { x: 1, y: 2, join: 'a-b' } })).toEqual([
      { x: 1, y: 2, join: 'a-b' },
    ]);
  });

  it('lee puertas[]', () => {
    const p = [{ x: 1, y: 2 }, { x: 3, y: 4, join: 'c-d' }];
    expect(puertasDe({ puertas: p })).toEqual(p);
  });

  it('serializa una puerta como puerta', () => {
    expect(serializarPuertas([{ x: 1, y: 2 }])).toEqual({ puerta: { x: 1, y: 2 } });
  });

  it('serializa varias como puertas[]', () => {
    const p = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    expect(serializarPuertas(p)).toEqual({ puertas: p });
  });

  it('idNodoPuerta distingue índices', () => {
    expect(idNodoPuerta('s-06')).toBe('puerta-s-06');
    expect(idNodoPuerta('s-06', 1)).toBe('puerta-s-06-2');
  });

  it('etiquetaPuerta numera si hay más de una', () => {
    expect(etiquetaPuerta('s-06', 0, 1)).toBe('s-06');
    expect(etiquetaPuerta('s-06', 1, 2)).toBe('s-06·2');
  });
});
