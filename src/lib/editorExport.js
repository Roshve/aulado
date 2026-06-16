/**
 * editorExport.js — import/export unificado para EditorCampus.
 */

import { serializarLugaresCampus } from './planoCoords.js';
import { slugPiso } from './planosRegistry.js';
import { puertasDe } from './puertasLugar.js';

/**
 * @param {{ pisoNumero: number, pisoEtiqueta?: string, nodos: Array, aristas: Array, lugares: Array }} datos
 */
export function exportPisoCompleto({ pisoNumero, pisoEtiqueta, nodos, aristas, lugares }) {
  const lugaresCampus = serializarLugaresCampus(lugares);
  const puertas = lugaresCampus.reduce((n, l) => n + puertasDe(l).length, 0);
  return {
    meta: {
      piso: pisoNumero,
      etiqueta: pisoEtiqueta ?? String(pisoNumero),
      exportadoEn: new Date().toISOString(),
    },
    campus: { lugares: lugaresCampus },
    grafo: { nodos, aristas },
    resumen: {
      nodos: nodos.length,
      aristas: aristas.length,
      lugares: lugaresCampus.length,
      puertas,
    },
  };
}

export function grafoFragmento(nodos, aristas) {
  return { nodos, aristas };
}

export function campusFragmento(lugares) {
  return serializarLugaresCampus(lugares);
}

/** Parsea borrador del extractor o export parcial de grafo. */
export function parseImportGrafo(data) {
  const piso = data.grafoPiso ?? {
    nodos: (data.nodes ?? data.nodos ?? []).map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      tipo: n.tipo ?? 'interseccion',
    })),
    aristas: (data.edges ?? data.aristas ?? []).map((edge) => {
      if (Array.isArray(edge)) return edge;
      return [edge.a ?? edge.from, edge.b ?? edge.to];
    }),
  };
  if (!piso.nodos?.length) {
    throw new Error('El archivo no contiene nodos');
  }
  return {
    nodos: piso.nodos.map((n) => ({ ...n })),
    aristas: (piso.aristas ?? []).map((a) => [...a]),
  };
}

/** Parsea export completo o fragmento de campus. */
export function parseImportCampus(data) {
  const lugares = data.campus?.lugares ?? data.lugares ?? data;
  if (!Array.isArray(lugares) || lugares.length === 0) {
    throw new Error('El archivo no contiene lugares');
  }
  return lugares.map((l) => ({
    ...l,
    coord: { ...l.coord },
    ...(l.puerta ? { puerta: { ...l.puerta } } : {}),
    ...(l.puertas ? { puertas: l.puertas.map((p) => ({ ...p })) } : {}),
  }));
}

/**
 * Aplica sugerencias de puertas (preview de sugerir_puertas.py).
 * @param {Array} lugares
 * @param {Array<{id: string, puerta?: object, status?: string}>} sugerencias
 */
export function aplicarSugerenciasPuertas(lugares, sugerencias) {
  const map = new Map(sugerencias.map((s) => [s.id, s]));
  return lugares.map((l) => {
    const sug = map.get(l.id);
    if (!sug?.puerta) return l;
    if (sug.status === 'skip' || sug.status === 'existing') return l;
    return {
      ...l,
      puerta: {
        x: sug.puerta.x,
        y: sug.puerta.y,
        ...(sug.puerta.join ? { join: sug.puerta.join } : {}),
        ...(l.puerta?.join && !sug.puerta.join ? { join: l.puerta.join } : {}),
      },
    };
  });
}

export function parseImportPuertas(data) {
  const items = Array.isArray(data) ? data : (data.puertas ?? data.lugares ?? []);
  if (!items.length) throw new Error('Sin sugerencias de puertas');
  return items;
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function nombreArchivoExport(pisoNumero, pisoEtiqueta) {
  return `export-${slugPiso(pisoEtiqueta ?? '', pisoNumero)}.json`;
}
