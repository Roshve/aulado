/**
 * routing.test.js — tests del motor de navegación A*.
 *
 * Usa datos ficticios mínimos (no campus.json real) para aislar la lógica.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { construirGrafo, calcularRuta, canonicalJoin, segmentoCoincide } from './routing.js';
import grafoData from '../data/grafo.json';
import campusData from '../data/campus.json';
import { aplanarLugares } from './campus.js';

// ─────────────────────────────────────────────────────────────────
// Datos de prueba mínimos
// ─────────────────────────────────────────────────────────────────

/**
 * Layout (piso 0):
 *
 *   hall(50,90) ─── n1(50,70) ─── n2(50,40) ─── n3(80,40)
 *
 * hall y asc0 están en las aristas, por lo que quedan directamente conectados.
 * aula-a y aula-b se enganchan por proyección sobre la arista más cercana.
 */
const GRAFO_DATA_SIMPLE = {
  pisos: {
    '0': {
      nodos: [
        { id: 'n1', x: 50, y: 70 },
        { id: 'n2', x: 50, y: 40 },
        { id: 'n3', x: 80, y: 40 },
      ],
      aristas: [
        ['hall', 'n1'],
        ['n1',   'n2'],
        ['n2',   'n3'],
        ['n3',   'asc0'],   // asc0 está en arista → no necesita spur
      ],
    },
    '1': {
      nodos: [
        { id: 'm1', x: 50, y: 60 },
        { id: 'm2', x: 80, y: 60 },
      ],
      aristas: [
        ['asc1', 'm1'],
        ['m1',   'm2'],
      ],
    },
  },
  verticales: [
    { tipo: 'ascensor', nodos: ['asc0', 'asc1'], costoFijo: 20, accesible: true },
  ],
};

/** Grafo solo con escalera (ruta por defecto usa escalera). */
const GRAFO_SOLO_ESCALERAS = {
  pisos: {
    '0': {
      nodos: [
        { id: 'n1', x: 50, y: 70 },
        { id: 'n2', x: 50, y: 40 },
      ],
      aristas: [['hall', 'n1'], ['n1', 'n2'], ['n2', 'esc0']],
    },
    '1': {
      nodos: [{ id: 'm1', x: 50, y: 60 }],
      aristas: [['esc1', 'm1'], ['m1', 'aula-c']],
    },
  },
  verticales: [
    { tipo: 'escalera', nodos: ['esc0', 'esc1'], costoFijo: 10, accesible: false },
  ],
};

/** Grafo con escalera y ascensor (modo accesible elige ascensor). */
const GRAFO_CON_AMBOS_VERTICALES = {
  ...GRAFO_SOLO_ESCALERAS,
  verticales: [
    { tipo: 'ascensor', nodos: ['asc0', 'asc1'], costoFijo: 20, accesible: true },
    { tipo: 'escalera', nodos: ['esc0', 'esc1'], costoFijo: 10, accesible: false },
  ],
  pisos: {
    '0': {
      ...GRAFO_SOLO_ESCALERAS.pisos['0'],
      aristas: [['hall', 'n1'], ['n1', 'n2'], ['n2', 'esc0'], ['n1', 'asc0']],
    },
    '1': {
      ...GRAFO_SOLO_ESCALERAS.pisos['1'],
      aristas: [['esc1', 'm1'], ['asc1', 'm1'], ['m1', 'aula-c']],
    },
  },
};

/** Lugares de piso 0 y piso 1. */
const LUGARES = [
  // piso 0
  { id: 'hall',   coord: { x: 50, y: 90 }, pisoNumero: 0, pisoEtiqueta: 'Planta Baja', planoPiso: '/planos/pb.png' },
  { id: 'asc0',   coord: { x: 80, y: 70 }, pisoNumero: 0, pisoEtiqueta: 'Planta Baja', planoPiso: '/planos/pb.png' },
  { id: 'aula-a', coord: { x: 20, y: 40 }, pisoNumero: 0, pisoEtiqueta: 'Planta Baja', planoPiso: '/planos/pb.png' },
  { id: 'aula-b', coord: { x: 80, y: 20 }, pisoNumero: 0, pisoEtiqueta: 'Planta Baja', planoPiso: '/planos/pb.png' },
  // piso 1
  { id: 'asc1',   coord: { x: 50, y: 70 }, pisoNumero: 1, pisoEtiqueta: '1er Piso', planoPiso: '/planos/p1.png' },
  { id: 'aula-c', coord: { x: 90, y: 60 }, pisoNumero: 1, pisoEtiqueta: '1er Piso', planoPiso: '/planos/p1.png' },
];

// ─────────────────────────────────────────────────────────────────
// construirGrafo
// ─────────────────────────────────────────────────────────────────

describe('construirGrafo', () => {
  it('incluye todos los lugares y nodos de corredor en positions', () => {
    const { positions } = construirGrafo(GRAFO_DATA_SIMPLE, LUGARES);
    // Nodos de corredor
    for (const id of ['n1', 'n2', 'n3', 'm1', 'm2']) {
      expect(positions.has(id), `falta nodo corredor ${id}`).toBe(true);
    }
    // Lugares de campus
    for (const l of LUGARES) {
      expect(positions.has(l.id), `falta lugar ${l.id}`).toBe(true);
    }
  });

  it('el piso de los nodos de corredor es correcto', () => {
    const { positions } = construirGrafo(GRAFO_DATA_SIMPLE, LUGARES);
    expect(positions.get('n1').piso).toBe(0);
    expect(positions.get('m1').piso).toBe(1);
  });

  it('hay aristas entre ascensores (conexión vertical)', () => {
    const { adj } = construirGrafo(GRAFO_DATA_SIMPLE, LUGARES);
    const vecinosAsc0 = adj.get('asc0').map((e) => e.to);
    expect(vecinosAsc0).toContain('asc1');
    const vecinosAsc1 = adj.get('asc1').map((e) => e.to);
    expect(vecinosAsc1).toContain('asc0');
  });

  it('lugares no conectados directamente tienen al menos un spur', () => {
    const { adj } = construirGrafo(GRAFO_DATA_SIMPLE, LUGARES);
    // aula-a y aula-b están en piso 0 y no en las aristas → deben tener spur
    expect(adj.get('aula-a').length).toBeGreaterThan(0);
    expect(adj.get('aula-b').length).toBeGreaterThan(0);
  });

  it('pisosInfo contiene etiqueta y plano de cada piso', () => {
    const { pisosInfo } = construirGrafo(GRAFO_DATA_SIMPLE, LUGARES);
    expect(pisosInfo.get(0)).toMatchObject({ etiqueta: 'Planta Baja', plano: '/planos/pb.png' });
    expect(pisosInfo.get(1)).toMatchObject({ etiqueta: '1er Piso', plano: '/planos/p1.png' });
  });
});

// ─────────────────────────────────────────────────────────────────
// calcularRuta — mismo piso
// ─────────────────────────────────────────────────────────────────

describe('calcularRuta — mismo piso', () => {
  let grafo;
  beforeAll(() => { grafo = construirGrafo(GRAFO_DATA_SIMPLE, LUGARES); });

  it('hall → aula-a retorna ok:true con 1 segmento', () => {
    const r = calcularRuta('hall', 'aula-a', grafo);
    expect(r.ok).toBe(true);
    expect(r.segmentos).toHaveLength(1);
  });

  it('el único segmento tiene piso 0 y esOrigen+esDestino', () => {
    const r = calcularRuta('hall', 'aula-a', grafo);
    const seg = r.segmentos[0];
    expect(seg.piso).toBe(0);
    expect(seg.esOrigen).toBe(true);
    expect(seg.esDestino).toBe(true);
    expect(seg.transicion).toBeNull();
  });

  it('los puntos del segmento incluyen origen y destino', () => {
    const r = calcularRuta('hall', 'aula-a', grafo);
    const puntos = r.segmentos[0].puntos;
    expect(puntos[0]).toMatchObject({ x: 50, y: 90 });
    expect(puntos[puntos.length - 1]).toMatchObject({ x: 20, y: 40 });
  });

  it('mismo origen y destino → 1 segmento de 1 punto, distanciaTotal 0', () => {
    const r = calcularRuta('hall', 'hall', grafo);
    expect(r.ok).toBe(true);
    expect(r.distanciaTotal).toBe(0);
    expect(r.segmentos[0].puntos).toHaveLength(1);
  });

  it('distanciaTotal es > 0 para puntos distintos', () => {
    const r = calcularRuta('hall', 'aula-b', grafo);
    expect(r.ok).toBe(true);
    expect(r.distanciaTotal).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// calcularRuta — multi-piso
// ─────────────────────────────────────────────────────────────────

describe('calcularRuta — multi-piso', () => {
  let grafo;
  beforeAll(() => { grafo = construirGrafo(GRAFO_DATA_SIMPLE, LUGARES); });

  it('hall → aula-c retorna 2 segmentos (piso 0 y piso 1)', () => {
    const r = calcularRuta('hall', 'aula-c', grafo);
    expect(r.ok).toBe(true);
    expect(r.segmentos).toHaveLength(2);
    expect(r.segmentos[0].piso).toBe(0);
    expect(r.segmentos[1].piso).toBe(1);
  });

  it('el primer segmento tiene esOrigen:true y transición no nula', () => {
    const r = calcularRuta('hall', 'aula-c', grafo);
    const s0 = r.segmentos[0];
    expect(s0.esOrigen).toBe(true);
    expect(s0.esDestino).toBe(false);
    expect(s0.transicion).not.toBeNull();
    expect(s0.transicion).toMatch(/ascensor/i);
  });

  it('el segundo segmento tiene esDestino:true y transición nula', () => {
    const r = calcularRuta('hall', 'aula-c', grafo);
    const s1 = r.segmentos[1];
    expect(s1.esOrigen).toBe(false);
    expect(s1.esDestino).toBe(true);
    expect(s1.transicion).toBeNull();
  });

  it('el último punto del seg 1 y el primero del seg 2 son los ascensores', () => {
    const r = calcularRuta('hall', 'aula-c', grafo);
    // Seg 0 debe terminar en asc0 (80,70)
    const lastP0 = r.segmentos[0].puntos.at(-1);
    expect(lastP0).toMatchObject({ x: 80, y: 70 });
    // Seg 1 debe empezar en asc1 (50,70)
    const firstP1 = r.segmentos[1].puntos[0];
    expect(firstP1).toMatchObject({ x: 50, y: 70 });
  });
});

// ─────────────────────────────────────────────────────────────────
// calcularRuta — casos de error
// ─────────────────────────────────────────────────────────────────

describe('calcularRuta — errores', () => {
  let grafo;
  beforeAll(() => { grafo = construirGrafo(GRAFO_DATA_SIMPLE, LUGARES); });

  it('origen inexistente → ok:false', () => {
    const r = calcularRuta('no-existe', 'hall', grafo);
    expect(r.ok).toBe(false);
    expect(r.mensaje).toBeTruthy();
  });

  it('destino inexistente → ok:false', () => {
    const r = calcularRuta('hall', 'no-existe', grafo);
    expect(r.ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Snap por proyección — comportamiento de la nueva lógica
// ─────────────────────────────────────────────────────────────────

describe('snap por proyección sobre arista más cercana', () => {
  it('aula-a (20,40 en piso 0) se proyecta sobre n1-n2 o n2-n3 y llega a n2', () => {
    // aula-a en (20,40). Segmentos del piso 0:
    //   hall(50,90)—n1(50,70): proyección de (20,40) cae en n1 (t→1), dist≈34
    //   n1(50,70)—n2(50,40):   proyección cae exactamente en n2 (t=1), dist=30
    //   n2(50,40)—n3(80,40):   proyección cae en n2 (t=0), dist=30
    //   n3(80,40)—asc0(80,70): proyección cae en n3 (t=0), dist≈60
    // Ganador: n1-n2 o n2-n3 con dist=30, ambos proyectan en n2 → conexión directa a n2.
    const { adj } = construirGrafo(GRAFO_DATA_SIMPLE, LUGARES);
    const vecinosA = adj.get('aula-a').map((e) => e.to);
    expect(vecinosA).toContain('n2');
  });

  it('aula-c (90,60 en piso 1) se proyecta sobre m1-m2 y llega a m2', () => {
    // m1(50,60)—m2(80,60): proyección de (90,60) → t→1 → m2(80,60), dist=10
    // asc1(50,70)—m1(50,60): dist más lejana
    const { adj } = construirGrafo(GRAFO_DATA_SIMPLE, LUGARES);
    const vecinosC = adj.get('aula-c').map((e) => e.to);
    expect(vecinosC).toContain('m2');
  });

  it('lugar lateral a un segmento largo crea nodo de unión perpendicular', () => {
    // Lugar en (30, 55) en piso 0:
    //   Segmento n1(50,70)—n2(50,40): proyección de (30,55) con ASPECT=2122/3000
    //     t = ((30-50)*0 + ((55-70)*ASPECT)*(40-70)*ASPECT) / len2 = 0.5 (mitad del segmento)
    //   → se crea nodo de unión j-mid-room en (50,55)
    const ASPECT = 2122 / 3000;
    const DATOS_CON_LATERAL = {
      pisos: {
        '0': {
          nodos: [
            { id: 'n1', x: 50, y: 70 },
            { id: 'n2', x: 50, y: 40 },
          ],
          aristas: [['n1', 'n2']],
        },
      },
      verticales: [],
    };
    const MID_ROOM = { id: 'mid-room', coord: { x: 30, y: 55 }, pisoNumero: 0, pisoEtiqueta: 'PB', planoPiso: '/pb.png' };
    const { positions, adj } = construirGrafo(DATOS_CON_LATERAL, [MID_ROOM]);

    // Debe haberse creado el nodo de unión j-mid-room
    const joinId = 'j-mid-room';
    expect(positions.has(joinId), 'debe existir nodo de unión j-mid-room').toBe(true);

    // El punto de unión debe estar sobre el segmento n1-n2 (x≈50, y≈55)
    const join = positions.get(joinId);
    expect(join.x).toBeCloseTo(50, 0);
    expect(join.y).toBeCloseTo(55, 1);

    // mid-room debe conectarse al nodo de unión
    const vecinosMid = adj.get('mid-room').map((e) => e.to);
    expect(vecinosMid).toContain(joinId);

    // El nodo de unión debe conectarse a n1 y n2
    const vecinosJoin = adj.get(joinId).map((e) => e.to);
    expect(vecinosJoin).toContain('n1');
    expect(vecinosJoin).toContain('n2');
  });

  it('lugar exactamente sobre un segmento no crea nodo de unión (t≈0.5 exacto)', () => {
    // Si el lugar está en el mismo punto que la proyección, la dist es 0
    // y se crea el nodo de unión en su misma posición; routing.ok debe ser true.
    const DATOS = {
      pisos: {
        '0': {
          nodos: [{ id: 'a', x: 0, y: 50 }, { id: 'b', x: 100, y: 50 }],
          aristas: [['a', 'b']],
        },
      },
      verticales: [],
    };
    const SOBRE_SEG = { id: 'sobre', coord: { x: 50, y: 50 }, pisoNumero: 0, pisoEtiqueta: 'PB', planoPiso: '/pb.png' };
    const grafo = construirGrafo(DATOS, [SOBRE_SEG]);
    // Debe poder enrutarse de a a sobre-seg
    const r = calcularRuta('a', 'sobre', grafo);
    expect(r.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// distPct con proporción del PNG
// ─────────────────────────────────────────────────────────────────

describe('distPct con proporción del PNG (ASPECT = 2122/3000)', () => {
  it('distancia entre lugares en el mismo piso se usa en pesos de arista', () => {
    // Con ASPECT, una diferencia de y% vale menos que la misma diferencia en x%.
    // Verificamos que el peso de la arista entre dos lugares (medido indirectamente
    // via distanciaTotal) refleje la proporción correcta.
    const DATOS = {
      pisos: {
        '0': {
          nodos: [
            { id: 'o', x: 0,  y: 0  },
            { id: 'dx', x: 10, y: 0  },   // 10% en x
            { id: 'dy', x: 0,  y: 10 },   // 10% en y (vale menos)
          ],
          aristas: [['o', 'dx'], ['o', 'dy']],
        },
      },
      verticales: [],
    };
    const LUGA = [
      { id: 'o',  coord: { x: 0,  y: 0  }, pisoNumero: 0, pisoEtiqueta: 'PB', planoPiso: '/pb.png' },
      { id: 'dx', coord: { x: 10, y: 0  }, pisoNumero: 0, pisoEtiqueta: 'PB', planoPiso: '/pb.png' },
      { id: 'dy', coord: { x: 0,  y: 10 }, pisoNumero: 0, pisoEtiqueta: 'PB', planoPiso: '/pb.png' },
    ];
    const grafo = construirGrafo(DATOS, LUGA);
    const rdx = calcularRuta('o', 'dx', grafo);
    const rdy = calcularRuta('o', 'dy', grafo);
    // El camino horizontal (10% en x) debe ser más "largo" geométricamente
    // que el vertical (10% en y) porque ASPECT < 1.
    expect(rdx.distanciaTotal).toBeGreaterThan(rdy.distanciaTotal);
    // Verificar relación aproximada: dist_x / dist_y ≈ 1 / ASPECT
    const ratio = rdx.distanciaTotal / rdy.distanciaTotal;
    const ASPECT = 2122 / 3000;
    expect(ratio).toBeCloseTo(1 / ASPECT, 2);
  });
});

// ─────────────────────────────────────────────────────────────────
// Modo accesible — excluye escaleras
// ─────────────────────────────────────────────────────────────────

describe('modo accesible', () => {
  const LUGARES_ESC = [
    { id: 'hall',   coord: { x: 50, y: 90 }, pisoNumero: 0, pisoEtiqueta: 'Planta Baja', planoPiso: '/planos/pb.png' },
    { id: 'esc0',   coord: { x: 30, y: 40 }, pisoNumero: 0, pisoEtiqueta: 'Planta Baja', planoPiso: '/planos/pb.png' },
    { id: 'esc1',   coord: { x: 30, y: 60 }, pisoNumero: 1, pisoEtiqueta: '1er Piso', planoPiso: '/planos/p1.png' },
    { id: 'aula-c', coord: { x: 50, y: 60 }, pisoNumero: 1, pisoEtiqueta: '1er Piso', planoPiso: '/planos/p1.png' },
  ];

  const LUGARES_AMBOS = [
    ...LUGARES_ESC,
    { id: 'asc0', coord: { x: 50, y: 70 }, pisoNumero: 0, pisoEtiqueta: 'Planta Baja', planoPiso: '/planos/pb.png' },
    { id: 'asc1', coord: { x: 50, y: 70 }, pisoNumero: 1, pisoEtiqueta: '1er Piso', planoPiso: '/planos/p1.png' },
  ];

  it('sin modo accesible usa escalera cuando es la única vertical', () => {
    const grafo = construirGrafo(GRAFO_SOLO_ESCALERAS, LUGARES_ESC);
    const r = calcularRuta('hall', 'aula-c', grafo);
    expect(r.ok).toBe(true);
    expect(r.segmentos[0].transicion).toMatch(/escalera/i);
  });

  it('modo accesible no conecta nodos de escalera vertical', () => {
    const { adj } = construirGrafo(GRAFO_CON_AMBOS_VERTICALES, LUGARES_AMBOS, { modoAccesible: true });
    const vecinosEsc0 = adj.get('esc0')?.map((e) => e.to) ?? [];
    expect(vecinosEsc0).not.toContain('esc1');
  });

  it('modo accesible mantiene conexión de ascensor', () => {
    const { adj } = construirGrafo(GRAFO_CON_AMBOS_VERTICALES, LUGARES_AMBOS, { modoAccesible: true });
    expect(adj.get('asc0').map((e) => e.to)).toContain('asc1');
  });

  it('hall → aula-c en modo accesible usa ascensor en transición', () => {
    const grafo = construirGrafo(GRAFO_CON_AMBOS_VERTICALES, LUGARES_AMBOS, { modoAccesible: true });
    const r = calcularRuta('hall', 'aula-c', grafo);
    expect(r.ok).toBe(true);
    expect(r.segmentos[0].transicion).toMatch(/ascensor/i);
  });

  it('aula con puerta engancha por el umbral, no por proyección del centro', () => {
    const DATOS = {
      pisos: {
        '-1': {
          nodos: [
            { id: 's-n14', x: 34.7, y: 79.8 },
            { id: 's-n3', x: 34.9, y: 58 },
          ],
          aristas: [['s-n14', 's-n3']],
        },
      },
      verticales: [],
    };
    const LUGAR = {
      id: 's-15',
      coord: { x: 41.6, y: 65.2 },
      puerta: { x: 34.8, y: 65.2, join: canonicalJoin('s-n14', 's-n3') },
      pisoNumero: -1,
      pisoEtiqueta: 'Subsuelo',
      planoPiso: '/planos/subsuelo.png',
    };
    const { adj, positions } = construirGrafo(DATOS, [LUGAR]);
    expect(positions.has('puerta-s-15')).toBe(true);
    expect(adj.get('s-15').map((e) => e.to)).toContain('puerta-s-15');
    const vecinosPuerta = adj.get('puerta-s-15').map((e) => e.to);
    expect(vecinosPuerta.some((id) => id === 's-n14' || id === 's-n3' || id === 'j-s-15')).toBe(true);
  });

  it('puerta.join fuerza el segmento aunque otro corredor sea más cercano (S-14)', () => {
    const DATOS = {
      pisos: {
        '-1': {
          nodos: [
            { id: 's-n3', x: 34.9, y: 58 },
            { id: 's-n7', x: 56.1, y: 57.7 },
            { id: 's-n12', x: 56, y: 11.6 },
          ],
          aristas: [['s-n3', 's-n7'], ['s-n12', 's-n7']],
        },
      },
      verticales: [],
    };
    const LUGAR = {
      id: 's-14',
      coord: { x: 50.4, y: 48.1 },
      puerta: { x: 52.5, y: 50.1, join: canonicalJoin('s-n3', 's-n7') },
      pisoNumero: -1,
      pisoEtiqueta: 'Subsuelo',
      planoPiso: '/planos/subsuelo.png',
    };
    const { adj, positions } = construirGrafo(DATOS, [LUGAR]);
    expect(segmentoCoincide(LUGAR.puerta.join, 's-n3', 's-n7')).toBe(true);

    const vecinosPuerta = adj.get('puerta-s-14').map((e) => e.to);
    expect(vecinosPuerta).toContain('j-s-14');
    expect(vecinosPuerta).not.toContain('s-n12');

    const jn = adj.get('j-s-14').map((e) => e.to).filter((id) => id !== 'puerta-s-14');
    expect(jn.sort()).toEqual(['s-n3', 's-n7']);
    expect(positions.get('j-s-14').y).toBeGreaterThan(55);
  });
});

// ─────────────────────────────────────────────────────────────────
// Integración campus real — Hall → S-14
// ─────────────────────────────────────────────────────────────────

function reconstruirPath(origen, destino, grafo) {
  const { adj, positions, verticalesPorPar = new Map(), modoAccesible = false } = grafo;
  const destPos = positions.get(destino);
  const destPiso = destPos?.piso;
  const gScore = new Map([[origen, 0]]);
  const cameFrom = new Map();
  const open = new Set([origen]);
  const closed = new Set();
  const ASPECT = 2122 / 3000;
  const PENALTY_ASCENSOR_A_SUBSUELO = 12;

  function h(id) {
    const pos = positions.get(id);
    if (!pos || pos.piso !== destPos.piso) return 0;
    return Math.hypot(destPos.x - pos.x, (destPos.y - pos.y) * ASPECT);
  }

  const fScore = new Map([[origen, h(origen)]]);

  while (open.size) {
    let current = null;
    let bestF = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < bestF) { bestF = f; current = id; }
    }
    if (current === destino) {
      const path = [];
      let n = current;
      while (n !== undefined) { path.unshift(n); n = cameFrom.get(n); }
      return path;
    }
    open.delete(current);
    closed.add(current);
    for (const { to, weight } of (adj.get(current) ?? [])) {
      if (closed.has(to)) continue;
      let edgeWeight = weight;
      if (destPiso === -1 && !modoAccesible) {
        const vert = verticalesPorPar.get([current, to].sort().join('|'));
        if (vert?.tipo === 'ascensor') edgeWeight += PENALTY_ASCENSOR_A_SUBSUELO;
      }
      const tg = (gScore.get(current) ?? Infinity) + edgeWeight;
      if (tg < (gScore.get(to) ?? Infinity)) {
        cameFrom.set(to, current);
        gScore.set(to, tg);
        fScore.set(to, tg + h(to));
        open.add(to);
      }
    }
  }
  return [];
}

describe('calcularRuta — campus real pb-hall → s-14', () => {
  const todosLugares = aplanarLugares(campusData);
  let grafo;
  let pathIds;

  beforeAll(() => {
    grafo = construirGrafo(grafoData, todosLugares);
    pathIds = reconstruirPath('pb-hall', 's-14', grafo);
  });

  it('encuentra ruta multi-piso', () => {
    const r = calcularRuta('pb-hall', 's-14', grafo);
    expect(r.ok).toBe(true);
    expect(r.segmentos.length).toBeGreaterThanOrEqual(2);
  });

  it('pasa por puerta-s-14 y j-s-14 en s-n6-s-n7', () => {
    expect(pathIds).toContain('puerta-s-14');
    expect(pathIds).toContain('j-s-14');
    const jn = grafo.adj.get('j-s-14').map((e) => e.to).filter((id) => id !== 'puerta-s-14');
    expect(jn.sort()).toEqual(['s-n6', 's-n7']);
  });

  it('baja por escalera (n1), no desvía hacia ascensor/streaming', () => {
    expect(pathIds).toContain('n1');
    expect(pathIds).not.toContain('pb-ascensor');
    expect(pathIds).not.toContain('n96');
    expect(pathIds).not.toContain('n101');
  });

  it('modo accesible usa ascensor vía n10 (corredor oeste)', () => {
    const grafoAcc = construirGrafo(grafoData, todosLugares, { modoAccesible: true });
    const pathAcc = reconstruirPath('pb-hall', 's-14', grafoAcc);
    expect(pathAcc).toContain('n10');
    expect(pathAcc).toContain('pb-ascensor');
    expect(pathAcc).not.toContain('n1');
    expect(pathAcc).not.toContain('n96');
  });
});

describe('calcularRuta — conexión vertical PB ↔ subsuelo', () => {
  const todosLugares = aplanarLugares(campusData);
  let grafo;

  beforeAll(() => {
    grafo = construirGrafo(grafoData, todosLugares);
  });

  it('escalera: n1 conecta con s-escalera (vertical)', () => {
    const pathIds = reconstruirPath('n1', 's-escalera', grafo);
    expect(pathIds).toEqual(['n1', 's-escalera']);
  });

  it('pb-hall llega a s-escalera por escalera (n1)', () => {
    const pathIds = reconstruirPath('pb-hall', 's-escalera', grafo);
    expect(pathIds.length).toBeGreaterThan(0);
    expect(pathIds).toContain('s-escalera');
    expect(pathIds).toContain('n1');
  });

  it('ascensor: pb-ascensor tiene enlace vertical directo con s-ascensor', () => {
    const vecinos = grafo.adj.get('pb-ascensor').map((e) => e.to);
    expect(vecinos).toContain('s-ascensor');
  });
});

describe('calcularRuta — subsuelo s-ascensor → s-14', () => {
  const todosLugares = aplanarLugares(campusData);
  let grafo;
  let pathIds;

  beforeAll(() => {
    grafo = construirGrafo(grafoData, todosLugares);
    pathIds = reconstruirPath('s-ascensor', 's-14', grafo);
  });

  it('pasa por la puerta calibrada, no corta pared desde el corredor', () => {
    expect(pathIds).toContain('puerta-s-14');
    expect(pathIds).toContain('j-s-14');
    const idxPuerta = pathIds.indexOf('puerta-s-14');
    const idxAula = pathIds.indexOf('s-14');
    expect(idxPuerta).toBeGreaterThan(-1);
    expect(idxAula).toBe(idxPuerta + 1);
  });
});
