import { describe, it, expect } from 'vitest';
import { aplanarLugares, getLugarById, getBreadcrumb, listarPisos, getPlanoPorPiso } from './campus.js';
// import.meta.env.BASE_URL se configura en vite.config.js → test.env

const CAMPUS_MOCK = {
  campus: { nombre: 'Test', direccion: 'Calle 1', centro: { lat: 0, lng: 0 }, zoomInicial: 15 },
  edificios: [
    {
      id: 'edif-test',
      nombre: 'Edificio Test',
      apodos: ['test', 'T'],
      entrada: { lat: 0, lng: 0 },
      pisos: [
        {
          numero: 0,
          etiqueta: 'Planta Baja',
          plano: '/planos/pb.png',
          lugares: [
            { id: 'a-01', nombre: 'Aula 01', tipo: 'aula', sinonimos: [], coord: { x: 50, y: 50 } },
            { id: 'bano-01', nombre: 'Baño PB', tipo: 'bano', sinonimos: [], coord: { x: 20, y: 80 } },
          ],
        },
        {
          numero: 1,
          etiqueta: '1er Piso',
          plano: '/planos/p1.png',
          lugares: [
            { id: 'lab-01', nombre: 'Lab 01', tipo: 'laboratorio', sinonimos: [], coord: { x: 30, y: 40 } },
          ],
        },
      ],
    },
  ],
};

describe('aplanarLugares', () => {
  const lista = aplanarLugares(CAMPUS_MOCK);

  it('produce un elemento por lugar', () => {
    expect(lista).toHaveLength(3);
  });

  it('adjunta datos del edificio a cada lugar', () => {
    const l = lista[0];
    expect(l.edificioId).toBe('edif-test');
    expect(l.edificioNombre).toBe('Edificio Test');
    expect(l.edificioApodos).toContain('test');
  });

  it('adjunta datos del piso', () => {
    const l = lista[0];
    expect(l.pisoNumero).toBe(0);
    expect(l.pisoEtiqueta).toBe('Planta Baja');
  });

  it('adjunta edificioPisos con todos los pisos del edificio', () => {
    const l = lista[0];
    expect(l.edificioPisos).toHaveLength(2);
    expect(l.edificioPisos.map((p) => p.numero)).toEqual([0, 1]);
  });
});

describe('getLugarById', () => {
  const lista = aplanarLugares(CAMPUS_MOCK);

  it('encuentra un lugar existente', () => {
    const l = getLugarById(lista, 'lab-01');
    expect(l).toBeDefined();
    expect(l.nombre).toBe('Lab 01');
  });

  it('devuelve undefined para un id inexistente', () => {
    expect(getLugarById(lista, 'no-existe')).toBeUndefined();
  });
});

describe('getBreadcrumb', () => {
  it('devuelve el formato esperado', () => {
    const lista = aplanarLugares(CAMPUS_MOCK);
    const l = lista[0];
    expect(getBreadcrumb(l)).toBe('Edificio Test · Planta Baja · aula');
  });
});

describe('listarPisos', () => {
  const pisos = listarPisos(CAMPUS_MOCK);

  it('devuelve un piso por cada piso del edificio', () => {
    expect(pisos).toHaveLength(2);
  });

  it('ordena por número de piso ascendente', () => {
    expect(pisos.map((p) => p.numero)).toEqual([0, 1]);
  });

  it('incluye etiqueta y plano resuelto', () => {
    expect(pisos[0].etiqueta).toBe('Planta Baja');
    // resolveAsset en test env: BASE_URL = '/' → '/planos/pb.png'
    expect(pisos[0].plano).toContain('pb.png');
    expect(pisos[1].plano).toContain('p1.png');
  });
});

describe('getPlanoPorPiso', () => {
  const pisos = listarPisos(CAMPUS_MOCK);

  it('devuelve el plano del piso solicitado', () => {
    expect(getPlanoPorPiso(pisos, 0)).toContain('pb.png');
    expect(getPlanoPorPiso(pisos, 1)).toContain('p1.png');
  });

  it('devuelve undefined para un número de piso que no existe', () => {
    expect(getPlanoPorPiso(pisos, 99)).toBeUndefined();
  });
});
