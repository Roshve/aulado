import { describe, it, expect } from 'vitest';
import { serializarLugaresCampus } from './planoCoords.js';

describe('serializarLugaresCampus', () => {
  it('conserva campos de campus.json y redondea coord a 1 decimal', () => {
    const lugares = [{
      id: 's-01',
      nombre: 'Aula S-01',
      sinonimos: ['s01'],
      tipo: 'aula',
      coord: { x: 27.123, y: 60.789 },
      pisoNumero: -1,
      aliasBusqueda: ['s01', 's-01'],
      edificioNombre: 'Edificio Principal',
    }];

    const out = serializarLugaresCampus(lugares);
    expect(out).toEqual([{
      id: 's-01',
      nombre: 'Aula S-01',
      sinonimos: ['s01'],
      tipo: 'aula',
      coord: { x: 27.1, y: 60.8 },
    }]);
  });

  it('incluye puerta sin modificarla', () => {
    const lugares = [{
      id: 's-02',
      nombre: 'Aula S-02',
      sinonimos: [],
      tipo: 'aula',
      coord: { x: 27.0, y: 48.4 },
      puerta: { x: 29.7, y: 48.4, join: 's-n3-s-n4' },
      pisoNumero: -1,
    }];

    const out = serializarLugaresCampus(lugares);
    expect(out[0].puerta).toEqual({ x: 29.7, y: 48.4, join: 's-n3-s-n4' });
    expect(out[0]).not.toHaveProperty('pisoNumero');
  });

  it('omite todos los campos enriquecidos', () => {
    const lugares = [{
      id: 's-ascensor',
      nombre: 'Escalera',
      sinonimos: [],
      tipo: 'acceso',
      coord: { x: 14, y: 82 },
      pisoNumero: -1,
      pisoEtiqueta: 'Subsuelo',
      planoPiso: '/planos/subsuelo.png',
      edificioId: 'campus-principal',
      edificioNombre: 'Edificio Principal',
      edificioApodos: ['tec'],
      edificioPisos: [],
      edificioEntrada: { lat: 0, lng: 0 },
      aliasBusqueda: ['escalera'],
    }];

    const out = serializarLugaresCampus(lugares);
    expect(Object.keys(out[0])).toEqual(['id', 'nombre', 'sinonimos', 'tipo', 'coord']);
  });
});
