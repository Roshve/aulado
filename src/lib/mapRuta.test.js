import { describe, it, expect } from 'vitest';
import {
  puntosALatLngs,
  segmentoEnPiso,
  indiceSegmentoEnPiso,
  hintSegmento,
  latlngAPct,
} from './mapRuta.js';

describe('puntosALatLngs', () => {
  it('convierte coordenadas % invirtiendo Y', () => {
    const [[lat, lng]] = puntosALatLngs([{ x: 10, y: 20 }]);
    expect(lng).toBe(10);
    expect(lat).toBe(80);
  });

  it('roundtrip con latlngAPct', () => {
    const original = { x: 45, y: 60 };
    const [[lat, lng]] = puntosALatLngs([original]);
    expect(latlngAPct({ lat, lng })).toEqual(original);
  });
});

describe('segmentoEnPiso', () => {
  const ruta = {
    ok: true,
    segmentos: [
      { piso: 0, etiqueta: 'PB', puntos: [] },
      { piso: -1, etiqueta: 'Subsuelo', puntos: [] },
    ],
  };

  it('encuentra el segmento del piso', () => {
    expect(segmentoEnPiso(ruta, -1)?.etiqueta).toBe('Subsuelo');
    expect(segmentoEnPiso(ruta, 2)).toBeNull();
  });

  it('indiceSegmentoEnPiso devuelve el índice correcto', () => {
    expect(indiceSegmentoEnPiso(ruta, -1)).toBe(1);
    expect(indiceSegmentoEnPiso(ruta, 99)).toBe(-1);
  });
});

describe('hintSegmento', () => {
  it('mismo piso origen y destino', () => {
    const hint = hintSegmento(
      { esOrigen: true, esDestino: true, etiqueta: 'PB' },
      { nombre: 'Hall' },
      { nombre: 'Aula' },
    );
    expect(hint).toContain('Hall');
    expect(hint).toContain('Aula');
  });

  it('segmento origen', () => {
    const hint = hintSegmento(
      { esOrigen: true, esDestino: false, etiqueta: 'Planta Baja' },
      { nombre: 'Hall' },
      { nombre: 'Aula' },
    );
    expect(hint).toContain('Planta Baja');
  });

  it('segmento destino', () => {
    const hint = hintSegmento(
      { esOrigen: false, esDestino: true, etiqueta: 'Subsuelo' },
      { nombre: 'Hall' },
      { nombre: 'S-14' },
    );
    expect(hint).toContain('S-14');
    expect(hint).toContain('Subsuelo');
  });

  it('segmento transición', () => {
    const hint = hintSegmento(
      { esOrigen: false, esDestino: false, etiqueta: 'Piso 1' },
      {},
      {},
    );
    expect(hint).toContain('Piso 1');
  });
});
