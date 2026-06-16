import { describe, it, expect } from 'vitest';
import {
  esMarcadorRojo,
  esPixelPared,
  aplicarMascaraParedes,
  BRILLO_PARED_DEFAULT,
} from './editorMascaraParedes.js';

describe('editorMascaraParedes', () => {
  it('detecta píxel oscuro como pared', () => {
    expect(esPixelPared(30, 30, 30)).toBe(true);
  });

  it('detecta píxel claro como no pared', () => {
    expect(esPixelPared(220, 220, 220)).toBe(false);
  });

  it('excluye marcador rojo aunque sea oscuro', () => {
    expect(esMarcadorRojo(200, 50, 50)).toBe(true);
    expect(esPixelPared(200, 50, 50)).toBe(false);
  });

  it('umbral custom altera el resultado', () => {
    expect(esPixelPared(150, 150, 150, 140)).toBe(false);
    expect(esPixelPared(150, 150, 150, 160)).toBe(true);
  });

  it('usa BRILLO_PARED_DEFAULT = 140', () => {
    expect(BRILLO_PARED_DEFAULT).toBe(140);
    expect(esPixelPared(130, 130, 130)).toBe(true);
    expect(esPixelPared(141, 141, 141)).toBe(false);
  });

  it('aplicarMascaraParedes tinta solo píxeles-pared', () => {
    const imageData = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        30, 30, 30, 255,
        220, 220, 220, 255,
      ]),
    };

    const out = aplicarMascaraParedes(imageData);
    expect(out.data[3]).toBeGreaterThan(0);
    expect(out.data[7]).toBe(0);
  });
});
