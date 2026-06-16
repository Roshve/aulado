import { describe, it, expect } from 'vitest';
import {
  ZOOM_MIN_LABELS,
  mostrarLabelsEnZoom,
  crearHtmlPoi,
} from './mapPois.js';

describe('mostrarLabelsEnZoom', () => {
  it('oculta labels por debajo del umbral', () => {
    expect(mostrarLabelsEnZoom(-2)).toBe(false);
    expect(mostrarLabelsEnZoom(-1)).toBe(false);
    expect(mostrarLabelsEnZoom(ZOOM_MIN_LABELS - 0.1)).toBe(false);
  });

  it('muestra labels en zoom normal o superior', () => {
    expect(mostrarLabelsEnZoom(0)).toBe(true);
    expect(mostrarLabelsEnZoom(1)).toBe(true);
    expect(mostrarLabelsEnZoom(4)).toBe(true);
  });
});

describe('crearHtmlPoi', () => {
  const lugar = { id: 's-01', nombre: 'Aula S-01', tipo: 'aula' };

  it('incluye nombre e icono del tipo', () => {
    const html = crearHtmlPoi(lugar);
    expect(html).toContain('Aula S-01');
    expect(html).toContain('🏫');
    expect(html).toContain('mapa-poi__label');
    expect(html).toContain('mapa-poi__icono');
  });

  it('oculta label cuando mostrarLabel es false', () => {
    const html = crearHtmlPoi(lugar, { mostrarLabel: false });
    expect(html).toContain('mapa-poi--sin-label');
  });

  it('añade clase seleccionado cuando corresponde', () => {
    const html = crearHtmlPoi(lugar, { seleccionado: true });
    expect(html).toContain('mapa-poi--seleccionado');
  });

  it('escapa caracteres HTML en el nombre', () => {
    const html = crearHtmlPoi(
      { id: 'x', nombre: 'Aula <script>', tipo: 'aula' },
      { mostrarLabel: true },
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
