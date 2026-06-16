#!/usr/bin/env node
/**
 * volcar_rutas.mjs — bridge Node ESM que computa rutas reales con routing.js
 * y las vuelca a scripts/preview/rutas.json para que verificar_grafo.py las dibuje.
 *
 * Uso:
 *   node scripts/volcar_rutas.mjs
 *
 * Salida: scripts/preview/rutas.json
 *   Array de rutas, cada una: { label, color, segmentos: [{piso, puntos:[{x,y}]}] }
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

// ── Importar funciones de routing real ───────────────────────────────────────
const { construirGrafo, calcularRuta } = await import(
  resolve(root, 'src/lib/routing.js')
);

// ── Leer datos ────────────────────────────────────────────────────────────────
const campusData = JSON.parse(readFileSync(resolve(root, 'src/data/campus.json'), 'utf8'));
const grafoData  = JSON.parse(readFileSync(resolve(root, 'src/data/grafo.json'), 'utf8'));

// ── aplanarLugares sin resolveAsset (evita import.meta.env de Vite) ──────────
function aplanarLugares(data) {
  const lista = [];
  for (const edificio of data.edificios) {
    const edificioPisos = edificio.pisos.map((p) => ({
      numero: p.numero,
      etiqueta: p.etiqueta,
      plano: p.plano,           // ruta cruda /planos/…
    }));
    for (const piso of edificio.pisos) {
      for (const lugar of piso.lugares) {
        lista.push({
          ...lugar,
          pisoNumero: piso.numero,
          pisoEtiqueta: piso.etiqueta,
          planoPiso: piso.plano,   // no resolvemos BASE_URL aquí
          edificioId: edificio.id,
          edificioNombre: edificio.nombre,
          edificioApodos: edificio.apodos,
          edificioPisos,
          edificioEntrada: edificio.entrada,
        });
      }
    }
  }
  return lista;
}

const todosLugares = aplanarLugares(campusData);
const grafo = construirGrafo(grafoData, todosLugares);

// ── Pares de rutas representativas por piso ───────────────────────────────────
// Criterio: (a) de un extremo al otro del piso, (b) aula → acceso vertical,
// (c) una ruta que use el ascensor (cross-piso) para verificar continuidad.
// Solo se incluyen IDs que existan en campus.json o en grafo.json como nodos.
const PARES = [
  // Subsuelo: de punta a punta y hacia el ascensor
  { label: 'S-01 → S-09',     a: 's-01',       b: 's-09',       color: [0, 180, 220] },
  { label: 'S-01 → S-asc',    a: 's-01',       b: 's-ascensor', color: [0, 220, 140] },
  { label: 'S-16 → S-07',     a: 's-16',       b: 's-07',       color: [0, 120, 255] },
  // Planta baja: hall a aula lejana, y de un lateral al otro
  { label: 'PB-Hall → 66',    a: 'pb-hall',    b: 'pb-66',      color: [255, 165,  0] },
  { label: 'PB-20 → PB-68',   a: 'pb-20',      b: 'pb-68',      color: [220,  50, 50] },
  { label: 'PB-bedelia → 50', a: 'pb-bedelia', b: 'pb-50',      color: [200, 100,  0] },
  // Primer piso
  { label: 'P1-asc → 168',    a: 'p1-ascensor',b: 'p1-168',     color: [160,  80, 220] },
  { label: 'P1-101 → P1-167', a: 'p1-101',     b: 'p1-167',     color: [80,  160, 220] },
  { label: 'P1-131 → P1-153', a: 'p1-131',     b: 'p1-153',     color: [40,  200, 180] },
  // Segundo piso
  { label: 'P2-asc → 280',    a: 'p2-ascensor',b: 'p2-280',     color: [220, 160,  0] },
  { label: 'P2-231 → P2-284', a: 'p2-231',     b: 'p2-284',     color: [100, 200,  80] },
  { label: 'P2-261 → P2-277', a: 'p2-261',     b: 'p2-277',     color: [180, 60,  220] },
  // Cross-piso: hall → segundo piso (verifica ascensor)
  { label: 'PB-Hall → P2-284',a: 'pb-hall',    b: 'p2-284',     color: [200,  30, 180] },
];

// ── Calcular y filtrar ────────────────────────────────────────────────────────
const rutas = [];
let warnings = 0;
for (const par of PARES) {
  const res = calcularRuta(par.a, par.b, grafo);
  if (!res.ok) {
    console.warn(`[WARN] ${par.label}: ${res.mensaje}`);
    warnings++;
    continue;
  }
  rutas.push({
    label: par.label,
    color: par.color,
    segmentos: res.segmentos.map((s) => ({
      piso: s.piso,
      puntos: s.puntos,
    })),
  });
}

// ── Guardar ───────────────────────────────────────────────────────────────────
mkdirSync(resolve(__dir, 'preview'), { recursive: true });
const out = resolve(__dir, 'preview/rutas.json');
writeFileSync(out, JSON.stringify(rutas, null, 2));

console.log(`Rutas exportadas: ${rutas.length}/${PARES.length} a ${out}`);
if (warnings) console.warn(`  (${warnings} pares no resueltos — IDs no encontrados en el grafo)`);
