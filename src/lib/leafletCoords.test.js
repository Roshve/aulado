/**
 * leafletCoords.test.js — tests de conversión de coordenadas.
 *
 * No necesita entorno DOM porque leafletCoords.js no importa Leaflet.
 */
import { describe, it, expect } from 'vitest';
import { BOUNDS, pctALatLng, latlngAPct, boundsParaPlano } from './leafletCoords.js';

// ── BOUNDS ─────────────────────────────────────────────────────────────────

describe('BOUNDS', () => {
  it('es [[0,0],[100,100]]', () => {
    expect(BOUNDS).toEqual([[0, 0], [100, 100]]);
  });
});

// ── pctALatLng ─────────────────────────────────────────────────────────────

describe('pctALatLng', () => {
  it('esquina superior-izquierda (0,0) → lat=100, lng=0', () => {
    expect(pctALatLng({ x: 0, y: 0 })).toEqual({ lat: 100, lng: 0 });
  });

  it('esquina inferior-derecha (100,100) → lat=0, lng=100', () => {
    expect(pctALatLng({ x: 100, y: 100 })).toEqual({ lat: 0, lng: 100 });
  });

  it('esquina inferior-izquierda (0,100) → lat=0, lng=0', () => {
    expect(pctALatLng({ x: 0, y: 100 })).toEqual({ lat: 0, lng: 0 });
  });

  it('esquina superior-derecha (100,0) → lat=100, lng=100', () => {
    expect(pctALatLng({ x: 100, y: 0 })).toEqual({ lat: 100, lng: 100 });
  });

  it('centro (50,50) → lat=50, lng=50', () => {
    expect(pctALatLng({ x: 50, y: 50 })).toEqual({ lat: 50, lng: 50 });
  });

  it('invierte el eje Y: y mayor → lat menor', () => {
    const a = pctALatLng({ x: 50, y: 20 });
    const b = pctALatLng({ x: 50, y: 80 });
    expect(a.lat).toBeGreaterThan(b.lat);
  });

  it('lng es siempre igual a x', () => {
    for (const x of [0, 25, 50, 75, 100]) {
      expect(pctALatLng({ x, y: 30 }).lng).toBe(x);
    }
  });
});

// ── latlngAPct ─────────────────────────────────────────────────────────────

describe('latlngAPct', () => {
  it('lat=100, lng=0 → (0,0)', () => {
    expect(latlngAPct({ lat: 100, lng: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('lat=0, lng=100 → (100,100)', () => {
    expect(latlngAPct({ lat: 0, lng: 100 })).toEqual({ x: 100, y: 100 });
  });

  it('lat=50, lng=50 → (50,50)', () => {
    expect(latlngAPct({ lat: 50, lng: 50 })).toEqual({ x: 50, y: 50 });
  });
});

// ── Roundtrip ───────────────────────────────────────────────────────────────

describe('roundtrip pctALatLng → latlngAPct', () => {
  const puntos = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
    { x: 50, y: 50 },
    { x: 23.5, y: 71.8 },
    { x: 0.1, y: 99.9 },
  ];

  for (const p of puntos) {
    it(`roundtrip (${p.x}, ${p.y})`, () => {
      const resultado = latlngAPct(pctALatLng(p));
      expect(resultado.x).toBeCloseTo(p.x, 10);
      expect(resultado.y).toBeCloseTo(p.y, 10);
    });
  }
});

// ── boundsParaPlano ─────────────────────────────────────────────────────────

describe('boundsParaPlano', () => {
  it('devuelve BOUNDS para cualquier piso', () => {
    for (const piso of [-1, 0, 1, 2, 99]) {
      expect(boundsParaPlano(piso)).toBe(BOUNDS); // misma referencia
    }
  });
});
