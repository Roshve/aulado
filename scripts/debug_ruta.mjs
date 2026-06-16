#!/usr/bin/env node
/**
 * Debug: imprime la ruta completa entre dos lugares.
 * Uso: node scripts/debug_ruta.mjs pb-hall s-14
 */
import grafoData from '../src/data/grafo.json' with { type: 'json' };
import campusData from '../src/data/campus.json' with { type: 'json' };
import { construirGrafo, calcularRuta } from '../src/lib/routing.js';

function aplanarLugares(data) {
  const lista = [];
  for (const edificio of data.edificios) {
    const edificioPisos = edificio.pisos.map((p) => ({
      numero: p.numero, etiqueta: p.etiqueta, plano: p.plano,
    }));
    for (const piso of edificio.pisos) {
      for (const lugar of piso.lugares) {
        lista.push({
          ...lugar,
          edificioId: edificio.id,
          edificioNombre: edificio.nombre,
          pisoNumero: piso.numero,
          pisoEtiqueta: piso.etiqueta,
          planoPiso: piso.plano,
          edificioPisos,
        });
      }
    }
  }
  return lista;
}

const [origenId, destinoId] = process.argv.slice(2);
if (!origenId || !destinoId) {
  console.error('Uso: node scripts/debug_ruta.mjs <origen> <destino>');
  process.exit(1);
}

const lugares = aplanarLugares(campusData);
const nombres = Object.fromEntries(lugares.map((l) => [l.id, l.nombre]));
const grafo = construirGrafo(grafoData, lugares);

const ASPECT = 2122 / 3000;

function reconstruirPath(from, to) {
  const { adj, positions } = grafo;
  const destPos = positions.get(to);
  const open = new Set([from]);
  const came = new Map([[from, null]]);
  const gScore = new Map([[from, 0]]);

  function h(id) {
    const pos = positions.get(id);
    if (!pos || pos.piso !== destPos.piso) return 0;
    return Math.hypot(destPos.x - pos.x, (destPos.y - pos.y) * ASPECT);
  }

  const fScore = new Map([[from, h(from)]]);

  while (open.size) {
    let current = null;
    let bestF = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < bestF) { bestF = f; current = id; }
    }
    if (current === to) {
      const path = [];
      let n = current;
      while (n !== undefined) { path.unshift(n); n = came.get(n); }
      return path;
    }
    open.delete(current);
    for (const { to: nb, weight } of adj.get(current) ?? []) {
      const tg = (gScore.get(current) ?? Infinity) + weight;
      if (tg < (gScore.get(nb) ?? Infinity)) {
        came.set(nb, current);
        gScore.set(nb, tg);
        fScore.set(nb, tg + h(nb));
        open.add(nb);
      }
    }
  }
  return [];
}

const pathIds = reconstruirPath(origenId, destinoId);
const r = calcularRuta(origenId, destinoId, grafo);

console.log(`\nRuta: ${nombres[origenId] ?? origenId} → ${nombres[destinoId] ?? destinoId}`);
console.log(`ok=${r.ok} distancia=${r.distanciaTotal?.toFixed(1)} segmentos=${r.segmentos?.length}\n`);

console.log('--- Nodos del camino ---');
for (const id of pathIds) {
  const p = grafo.positions.get(id);
  if (!p) { console.log(`  ${String(id).padEnd(22)} (sin posición)`); continue; }
  const nombre = nombres[id] ?? id;
  console.log(`  ${String(id).padEnd(22)} piso=${p.piso}  (${p.x.toFixed(1)}, ${p.y.toFixed(1)})  ${nombre}`);
}

console.log('\n--- Segmentos (puntos dibujados en UI) ---');
for (const seg of r.segmentos ?? []) {
  console.log(`\n[${seg.etiqueta}] ${seg.puntos.length} puntos${seg.transicion ? ` → ${seg.transicion}` : ''}`);
  for (const pt of seg.puntos) {
    const match = pathIds.find((id) => {
      const p = grafo.positions.get(id);
      return p && Math.abs(p.x - pt.x) < 0.05 && Math.abs(p.y - pt.y) < 0.05;
    });
    console.log(`  (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})  ${match ?? '?'}`);
  }
}

const sospechosos = pathIds.filter((id) => id.includes('streaming') || id.includes('pb-sala'));
console.log('\n--- ¿Pasa por streaming? ---', sospechosos.length ? sospechosos : 'No');
