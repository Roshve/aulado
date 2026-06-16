/**
 * routing.js — construcción del grafo de navegación y cálculo de rutas A*.
 *
 * Exporta:
 *   construirGrafo(grafoData, todosLugares, options?) → { positions, adj, pisosInfo, verticalesPorPar }
 *   calcularRuta(origenId, destinoId, grafo)  → { ok, segmentos, distanciaTotal }
 *
 * Estructura de un segmento de ruta:
 *   {
 *     piso:       number,          // número de piso (-1, 0, 1, 2)
 *     etiqueta:   string,          // "Planta Baja", etc.
 *     plano:      string,          // URL del PNG del piso
 *     puntos:     [{x, y}],        // coordenadas en % (0-100) sobre el PNG
 *     esOrigen:   boolean,         // true en el primer segmento
 *     esDestino:  boolean,         // true en el último segmento
 *     transicion: string|null,     // texto para pasar al siguiente piso, null si es el último
 *   }
 */

import { puertasDe, idNodoPuerta } from './puertasLugar.js';

// ─────────────────────────────────────────────────────────────────
// Construcción del grafo
// ─────────────────────────────────────────────────────────────────

/**
 * Normaliza una arista de grafo.json (par [a,b] u objeto extendido).
 * @returns {{ a: string, b: string, accesible: boolean, peso: number|null }}
 */
function parseArista(arista) {
  if (Array.isArray(arista)) {
    return { a: arista[0], b: arista[1], accesible: true, peso: null };
  }
  return {
    a: arista.from ?? arista.a,
    b: arista.to ?? arista.b,
    accesible: arista.accesible !== false,
    peso: arista.peso ?? null,
  };
}

/**
 * Construye el grafo de navegación combinando:
 *   - Waypoints de corredor de grafo.json
 *   - Lugares de campus.json (enganchados por spur al nodo más cercano de su piso)
 *   - Conexiones verticales (ascensor / escaleras)
 *
 * @param {Object} grafoData   - Contenido de src/data/grafo.json
 * @param {Array}  todosLugares - Lista de lugares enriquecidos (aplanarLugares)
 * @param {{ modoAccesible?: boolean }} [options]
 * @returns {{ positions: Map, adj: Map, pisosInfo: Map, verticalesPorPar: Map, modoAccesible: boolean }}
 */
export function construirGrafo(grafoData, todosLugares, options = {}) {
  const modoAccesible = options.modoAccesible === true;

  // positions: id → { x, y, piso }
  const positions = new Map();
  // adj: id → [{ to: string, weight: number }]
  const adj = new Map();
  // verticalesPorPar: "a|b" → { tipo, accesible }
  const verticalesPorPar = new Map();

  function addNode(id, x, y, piso) {
    if (!positions.has(id)) {
      positions.set(id, { x, y, piso });
      adj.set(id, []);
    }
  }

  function addEdge(a, b, weight) {
    if (!positions.has(a) || !positions.has(b)) return;
    const w = weight ?? distPct(positions.get(a), positions.get(b));
    adj.get(a).push({ to: b, weight: w });
    adj.get(b).push({ to: a, weight: w });
  }

  // ── 1. Waypoints de corredor (de grafo.json) ─────────────────
  for (const [pisoStr, pisoDatos] of Object.entries(grafoData.pisos)) {
    const piso = parseInt(pisoStr, 10);
    for (const n of pisoDatos.nodos) {
      addNode(n.id, n.x, n.y, piso);
    }
  }

  // ── 2. Lugares de campus.json ─────────────────────────────────
  for (const lugar of todosLugares) {
    addNode(lugar.id, lugar.coord.x, lugar.coord.y, lugar.pisoNumero);
  }

  // ── 3. Aristas de corredor dentro de cada piso ────────────────
  const directamentConectados = new Set();
  for (const [, pisoDatos] of Object.entries(grafoData.pisos)) {
    for (const raw of pisoDatos.aristas) {
      const { a, b, accesible, peso } = parseArista(raw);
      if (modoAccesible && !accesible) continue;
      addEdge(a, b, peso ?? undefined);
      directamentConectados.add(a);
      directamentConectados.add(b);
    }
  }

  // ── 4. Spur: enganchar cada lugar al punto más cercano del corredor ──
  const aristasPorPiso = new Map();
  for (const [pisoStr, pisoDatos] of Object.entries(grafoData.pisos)) {
    const piso = parseInt(pisoStr, 10);
    const segs = [];
    for (const raw of pisoDatos.aristas) {
      const { a: aId, b: bId, accesible } = parseArista(raw);
      if (modoAccesible && !accesible) continue;
      const pa = positions.get(aId);
      const pb = positions.get(bId);
      if (pa && pb) segs.push({ aId, bId, pa, pb });
    }
    aristasPorPiso.set(piso, segs);
  }

  const T_ENDPOINT = 0.05;

  for (const lugar of todosLugares) {
    if (directamentConectados.has(lugar.id)) continue;
    const segs = aristasPorPiso.get(lugar.pisoNumero) ?? [];
    const centro = { x: lugar.coord.x, y: lugar.coord.y };

    if (segs.length === 0) {
      const nodos = [...(grafoData.pisos[String(lugar.pisoNumero)]?.nodos ?? [])];
      let nearest = null; let minD = Infinity;
      for (const n of nodos) {
        const pos = positions.get(n.id);
        if (!pos) continue;
        const d = distPct(pos, centro);
        if (d < minD) { minD = d; nearest = n.id; }
      }
      if (nearest !== null) addEdge(lugar.id, nearest);
      continue;
    }

    const puertas = puertasDe(lugar);
    if (puertas.length > 0) {
      puertas.forEach((puerta, i) => {
        const pt = { x: puerta.x, y: puerta.y };
        const puertaId = idNodoPuerta(lugar.id, i);
        const joinBase = i === 0 ? lugar.id : `${lugar.id}-${i + 1}`;
        addNode(puertaId, pt.x, pt.y, lugar.pisoNumero);
        addEdge(lugar.id, puertaId, distPct(centro, pt));
        engancharAlCorredor(
          puertaId, joinBase, pt, lugar.pisoNumero, segs, T_ENDPOINT, addNode, addEdge,
          puerta.join ?? null,
        );
      });
    } else {
      engancharAlCorredor(lugar.id, lugar.id, centro, lugar.pisoNumero, segs, T_ENDPOINT, addNode, addEdge);
    }
  }

  // ── 5. Conexiones verticales (ascensor/escaleras) ─────────────
  for (const vert of grafoData.verticales ?? []) {
    if (modoAccesible && vert.accesible === false) continue;
    const costo = vert.costoFijo ?? 20;
    const nodos = vert.nodos;
    for (let i = 0; i < nodos.length - 1; i++) {
      const a = nodos[i];
      const b = nodos[i + 1];
      if (!positions.has(a) || !positions.has(b)) continue;
      addEdge(a, b, costo);
      const key = [a, b].sort().join('|');
      verticalesPorPar.set(key, { tipo: vert.tipo ?? 'vertical', accesible: vert.accesible !== false });
    }
  }

  // ── 6. pisosInfo: piso → { etiqueta, plano } ─────────────────
  const pisosInfo = new Map();
  for (const lugar of todosLugares) {
    if (!pisosInfo.has(lugar.pisoNumero)) {
      pisosInfo.set(lugar.pisoNumero, {
        etiqueta: lugar.pisoEtiqueta,
        plano: lugar.planoPiso,
      });
    }
  }

  return { positions, adj, pisosInfo, verticalesPorPar, modoAccesible };
}

// ─────────────────────────────────────────────────────────────────
// A* y construcción de segmentos
// ─────────────────────────────────────────────────────────────────

/**
 * Calcula la ruta más corta entre dos lugares usando A*.
 *
 * @param {string} origenId
 * @param {string} destinoId
 * @param {{ positions: Map, adj: Map, pisosInfo: Map, verticalesPorPar?: Map }} grafo
 * @returns {{ ok: boolean, segmentos?: Array, distanciaTotal?: number, mensaje?: string }}
 */
export function calcularRuta(origenId, destinoId, grafo) {
  const { positions, adj, pisosInfo, verticalesPorPar = new Map(), modoAccesible = false } = grafo;

  if (!positions.has(origenId)) {
    return { ok: false, mensaje: `Origen "${origenId}" no está en el grafo` };
  }
  if (!positions.has(destinoId)) {
    return { ok: false, mensaje: `Destino "${destinoId}" no está en el grafo` };
  }

  if (origenId === destinoId) {
    const pos = positions.get(origenId);
    const info = pisosInfo.get(pos.piso) ?? {};
    return {
      ok: true,
      distanciaTotal: 0,
      segmentos: [{
        piso: pos.piso,
        etiqueta: info.etiqueta ?? String(pos.piso),
        plano: info.plano ?? '',
        puntos: [{ x: pos.x, y: pos.y }],
        esOrigen: true,
        esDestino: true,
        transicion: null,
      }],
    };
  }

  const destPos = positions.get(destinoId);

  function h(id) {
    const pos = positions.get(id);
    if (!pos || pos.piso !== destPos.piso) return 0;
    return distPct(pos, destPos);
  }

  const gScore = new Map([[origenId, 0]]);
  const fScore = new Map([[origenId, h(origenId)]]);
  const cameFrom = new Map();
  const openSet = new Set([origenId]);
  const closedSet = new Set();

  while (openSet.size > 0) {
    let current = null;
    let bestF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity;
      if (f < bestF) { bestF = f; current = id; }
    }

    if (current === destinoId) {
      const path = [];
      let node = current;
      while (node !== undefined) {
        path.unshift(node);
        node = cameFrom.get(node);
      }
      return buildSegmentos(path, positions, pisosInfo, verticalesPorPar, gScore.get(destinoId) ?? 0);
    }

    openSet.delete(current);
    closedSet.add(current);

    for (const { to, weight } of (adj.get(current) ?? [])) {
      if (closedSet.has(to)) continue;
      let edgeWeight = weight;
      if (destPos.piso === -1 && !modoAccesible) {
        const vertKey = [current, to].sort().join('|');
        const vert = verticalesPorPar.get(vertKey);
        if (vert?.tipo === 'ascensor') {
          edgeWeight += PENALTY_ASCENSOR_A_SUBSUELO;
        }
      }
      const tentativeG = (gScore.get(current) ?? Infinity) + edgeWeight;
      if (tentativeG < (gScore.get(to) ?? Infinity)) {
        cameFrom.set(to, current);
        gScore.set(to, tentativeG);
        fScore.set(to, tentativeG + h(to));
        openSet.add(to);
      }
    }
  }

  return { ok: false, mensaje: 'No se encontró un camino entre los dos lugares' };
}

// ─────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────

const ASPECT = 2122 / 3000;
/** Penalización al usar ascensor cuando el destino está en subsuelo (prefiere escalera). */
const PENALTY_ASCENSOR_A_SUBSUELO = 12;
/** Distancia máxima (%) del centro/puerta al corredor — evita spurs absurdos. */
const MAX_SPUR_PCT = 12;

function distPct(a, b) {
  return Math.hypot(b.x - a.x, (b.y - a.y) * ASPECT);
}

function proyectarEnSegmento(p, a, b) {
  const dx = b.x - a.x;
  const dy = (b.y - a.y) * ASPECT;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return { t: 0, punto: { x: a.x, y: a.y }, dist: distPct(p, a) };
  }
  const t = Math.max(0, Math.min(1,
    ((p.x - a.x) * dx + ((p.y - a.y) * ASPECT) * dy) / len2
  ));
  const punto = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  return { t, punto, dist: distPct(p, punto) };
}

/** Formato canónico de segmento para `puerta.join` (orden alfabético de ids). */
export function canonicalJoin(aId, bId) {
  return [aId, bId].sort().join('-');
}

/** True si el segmento {aId,bId} coincide con el hint `puerta.join`. */
export function segmentoCoincide(joinHint, aId, bId) {
  if (!joinHint) return true;
  return canonicalJoin(aId, bId) === joinHint;
}

/**
 * Elige la proyección al corredor más razonable (cerca y no demasiado lejos).
 * @param {string|null} [joinHint] - Segmento calibrado offline (`puerta.join`).
 */
function elegirProyeccionSpur(anchor, segs, maxSpurPct = MAX_SPUR_PCT, joinHint = null) {
  let poolSegs = segs;
  if (joinHint) {
    const filtrados = segs.filter((s) => segmentoCoincide(joinHint, s.aId, s.bId));
    if (filtrados.length > 0) {
      poolSegs = filtrados;
    } else if (import.meta.env?.DEV) {
      console.warn(`[routing] puerta.join "${joinHint}" no coincide con ningún segmento del piso`);
    }
  }
  const candidatos = poolSegs.map((seg) => ({
    seg,
    ...proyectarEnSegmento(anchor, seg.pa, seg.pb),
  }));
  let pool = candidatos.filter((c) => c.dist <= maxSpurPct);
  if (pool.length === 0) pool = candidatos;
  return pool.reduce((best, c) => (c.dist < best.dist ? c : best));
}

/**
 * Engancha un punto (centro de aula o puerta) al corredor más cercano.
 */
function engancharAlCorredor(fromId, joinBaseId, anchor, piso, segs, tEndpoint, addNode, addEdge, joinHint = null) {
  const { seg, t, punto, dist: dJoin } = elegirProyeccionSpur(anchor, segs, MAX_SPUR_PCT, joinHint);
  if (t <= tEndpoint) {
    addEdge(fromId, seg.aId, dJoin);
    return;
  }
  if (t >= 1 - tEndpoint) {
    addEdge(fromId, seg.bId, dJoin);
    return;
  }
  const joinId = `j-${joinBaseId}`;
  addNode(joinId, punto.x, punto.y, piso);
  addEdge(joinId, seg.aId, distPct(seg.pa, punto));
  addEdge(joinId, seg.bId, distPct(seg.pb, punto));
  addEdge(fromId, joinId, dJoin);
}

const ETIQUETA_PISO = {
  '-1': 'Subsuelo',
  0: 'Planta Baja',
  1: '1er Piso',
  2: '2do Piso',
};

const ETIQUETA_VERTICAL = {
  ascensor: 'ascensor',
  escalera: 'escalera',
};

/**
 * Detecta el tipo de conexión vertical usada entre dos nodos consecutivos del camino.
 */
function tipoTransicionVertical(fromId, toId, verticalesPorPar) {
  const key = [fromId, toId].sort().join('|');
  const vert = verticalesPorPar.get(key);
  return vert?.tipo ?? 'ascensor';
}

function buildSegmentos(path, positions, pisosInfo, verticalesPorPar, distanciaTotal) {
  const segmentos = [];
  let currentPiso = null;
  let currentSeg = null;

  for (const id of path) {
    const pos = positions.get(id);
    if (!pos) continue;
    const piso = pos.piso;

    if (piso !== currentPiso) {
      if (currentSeg) segmentos.push(currentSeg);
      const info = pisosInfo.get(piso) ?? {};
      currentPiso = piso;
      currentSeg = {
        piso,
        etiqueta: info.etiqueta ?? ETIQUETA_PISO[piso] ?? `Piso ${piso}`,
        plano: info.plano ?? '',
        puntos: [],
        esOrigen: segmentos.length === 0,
        esDestino: false,
        transicion: null,
      };
    }
    currentSeg.puntos.push({ x: pos.x, y: pos.y });
  }

  if (currentSeg) {
    currentSeg.esDestino = true;
    segmentos.push(currentSeg);
  }

  // Mensajes de transición entre pisos (según ascensor o escalera usada)
  for (let i = 0; i < segmentos.length - 1; i++) {
    const desdePiso = segmentos[i].piso;
    const hastaPiso = segmentos[i + 1].piso;
    const dir = hastaPiso > desdePiso ? '⬆️ Subí' : '⬇️ Bajá';
    const label = ETIQUETA_PISO[hastaPiso] ?? `Piso ${hastaPiso}`;

    let tipoVert = 'ascensor';
    for (let j = 0; j < path.length - 1; j++) {
      const pFrom = positions.get(path[j]);
      const pTo = positions.get(path[j + 1]);
      if (pFrom && pTo && pFrom.piso === desdePiso && pTo.piso === hastaPiso) {
        tipoVert = tipoTransicionVertical(path[j], path[j + 1], verticalesPorPar);
        break;
      }
    }

    const medio = ETIQUETA_VERTICAL[tipoVert] ?? tipoVert;
    segmentos[i].transicion = `${dir} al ${label} por ${medio === 'escalera' ? 'la escalera' : 'el ascensor'}`;
  }

  return { ok: true, segmentos, distanciaTotal };
}
