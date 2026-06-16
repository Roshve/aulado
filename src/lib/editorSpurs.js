/**
 * editorSpurs.js — preview de spurs lugar→corredor para el editor.
 */

import { canonicalJoin, segmentoCoincide } from './routing.js';

const ASPECT = 2122 / 3000;
const MAX_SPUR_PCT = 12;

export function distPct(a, b) {
  return Math.hypot(b.x - a.x, (b.y - a.y) * ASPECT);
}

export function proyectarEnSegmento(p, a, b) {
  const dx = b.x - a.x;
  const dy = (b.y - a.y) * ASPECT;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return { t: 0, punto: { x: a.x, y: a.y }, dist: distPct(p, a) };
  }
  const t = Math.max(0, Math.min(1,
    ((p.x - a.x) * dx + ((p.y - a.y) * ASPECT) * dy) / len2,
  ));
  const punto = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  return { t, punto, dist: distPct(p, punto) };
}

/** Construye segmentos de corredor a partir de nodos/aristas del piso. */
export function segmentosCorredor(nodos, aristas) {
  const pos = Object.fromEntries(nodos.map((n) => [n.id, { x: n.x, y: n.y }]));
  return aristas
    .map(([aId, bId]) => {
      const pa = pos[aId];
      const pb = pos[bId];
      if (!pa || !pb) return null;
      return { aId, bId, pa, pb };
    })
    .filter(Boolean);
}

import { puertasDe } from './puertasLugar.js';

/**
 * Calcula la proyección spur de un punto al corredor.
 * @returns {{ origen: {x,y}, destino: {x,y}, dist: number, join: string|null, lejos: boolean } | null}
 */
export function calcularSpurPuerta(anchor, joinHint, nodos, aristas) {
  const segs = segmentosCorredor(nodos, aristas);
  if (segs.length === 0) return null;

  let poolSegs = segs;
  if (joinHint) {
    const filtrados = segs.filter((s) => segmentoCoincide(joinHint, s.aId, s.bId));
    if (filtrados.length > 0) poolSegs = filtrados;
  }

  const candidatos = poolSegs.map((seg) => ({
    seg,
    ...proyectarEnSegmento(anchor, seg.pa, seg.pb),
  }));
  let pool = candidatos.filter((c) => c.dist <= MAX_SPUR_PCT);
  if (pool.length === 0) pool = candidatos;
  const best = pool.reduce((a, c) => (c.dist < a.dist ? c : a));

  return {
    origen: anchor,
    destino: best.punto,
    dist: best.dist,
    join: canonicalJoin(best.seg.aId, best.seg.bId),
    lejos: best.dist > MAX_SPUR_PCT,
  };
}

/**
 * Calcula la proyección spur de un lugar al corredor.
 * @returns {{ origen: {x,y}, destino: {x,y}, dist: number, join: string|null, lejos: boolean, desdeCentro: boolean } | null}
 */
export function calcularSpurLugar(lugar, nodos, aristas) {
  const puertas = puertasDe(lugar);
  if (puertas.length > 0) {
    const p = puertas[0];
    const spur = calcularSpurPuerta({ x: p.x, y: p.y }, p.join ?? null, nodos, aristas);
    return spur ? { ...spur, desdeCentro: false } : null;
  }

  const centro = { x: lugar.coord.x, y: lugar.coord.y };
  const spur = calcularSpurPuerta(centro, null, nodos, aristas);
  return spur ? { ...spur, desdeCentro: true } : null;
}

/** Lista de spurs para todos los lugares del piso. */
export function spursDelPiso(lugares, nodos, aristas) {
  const out = [];
  for (const l of lugares) {
    const puertas = puertasDe(l);
    if (puertas.length === 0) {
      const spur = calcularSpurLugar(l, nodos, aristas);
      if (spur) out.push({ lugar: l, puertaIdx: null, spur });
      continue;
    }
    puertas.forEach((p, i) => {
      const spur = calcularSpurPuerta({ x: p.x, y: p.y }, p.join ?? null, nodos, aristas);
      if (spur) out.push({ lugar: l, puertaIdx: i, spur: { ...spur, desdeCentro: false } });
    });
  }
  return out;
}
