/**
 * search.js — búsqueda difusa sobre la lista de lugares del campus.
 *
 * Usa Fuse.js con keys sobre nombre, sinónimos, tipo y datos del edificio.
 * Normaliza el query (lowercase + sin acentos) antes de buscar.
 *
 * Exporta:
 *   crearBuscador(lugares)      → instancia de Fuse lista para usar
 *   filtrarLugares(...)         → filtro por tipo + búsqueda difusa
 *   buscar(fuse, query, ...)    → alias de filtrarLugares sin filtros de tipo
 *   normalizarQuery(query)      → string normalizado (uso interno, exportado para tests)
 *   segmentarResaltado(texto, query) → segmentos para highlight en UI
 */

import Fuse from 'fuse.js';

const MAX_RESULTADOS = 10;

// Threshold de Fuse: 0.0 = match exacto, 1.0 = todo. 0.4 da buena tolerancia a typos.
const FUSE_THRESHOLD = 0.4;

const FUSE_KEYS = [
  { name: 'nombre',         weight: 0.5 },
  { name: 'sinonimos',      weight: 0.35 },
  { name: 'tipo',           weight: 0.05 },
  { name: 'edificioNombre', weight: 0.05 },
  { name: 'edificioApodos', weight: 0.05 },
];

/**
 * Normaliza una cadena: lowercase y reemplaza caracteres con diacríticos.
 * Permite buscar "bano" y encontrar "Baño", etc.
 *
 * @param {string} str
 * @returns {string}
 */
export function normalizarQuery(str) {
  return str
    .toLowerCase()
    .normalize('NFD')                  // descompone acentos
    .replace(/[\u0300-\u036f]/g, ''); // elimina marcas diacríticas
}

/**
 * Divide texto en segmentos para resaltar coincidencias con query.
 * Insensible a acentos y mayúsculas; preserva el texto original en cada segmento.
 *
 * @param {string} texto
 * @param {string} query
 * @returns {Array<{ text: string, highlight: boolean }>}
 */
export function segmentarResaltado(texto, query) {
  const q = normalizarQuery(query.trim());
  if (!q) return [{ text: texto, highlight: false }];

  const map = [];
  let norm = '';
  for (let i = 0; i < texto.length; i++) {
    const n = normalizarQuery(texto[i]);
    for (const c of n) {
      norm += c;
      map.push(i);
    }
  }

  const segments = [];
  let normPos = 0;
  let origCursor = 0;

  while (normPos < norm.length) {
    const matchIdx = norm.indexOf(q, normPos);
    if (matchIdx === -1) {
      if (origCursor < texto.length) {
        segments.push({ text: texto.slice(origCursor), highlight: false });
      }
      break;
    }

    const matchStartOrig = map[matchIdx];
    const matchEndOrig = map[matchIdx + q.length - 1] + 1;

    if (matchStartOrig > origCursor) {
      segments.push({ text: texto.slice(origCursor, matchStartOrig), highlight: false });
    }
    segments.push({ text: texto.slice(matchStartOrig, matchEndOrig), highlight: true });
    origCursor = matchEndOrig;
    normPos = matchIdx + q.length;
  }

  return segments.length > 0 ? segments : [{ text: texto, highlight: false }];
}

/**
 * Crea el índice Fuse.js a partir de la lista aplanada de lugares.
 * Llamar una sola vez al iniciar la app (el índice es costoso de construir).
 *
 * @param {Array} lugares - Resultado de aplanarLugares(data)
 * @returns {Fuse} Instancia configurada
 */
export function crearBuscador(lugares) {
  return new Fuse(lugares, {
    keys: FUSE_KEYS,
    threshold: FUSE_THRESHOLD,
    includeScore: true,
    shouldSort: true,
    ignoreLocation: true,
    ignoreDiacritics: true,
  });
}

/**
 * Filtra por tipo(s) y/o busca por texto. Orden: filtro de tipo → búsqueda difusa.
 *
 * - Sin query ni filtros → []
 * - Sin query con filtros → todos los lugares de esos tipos
 * - Con query → hasta MAX_RESULTADOS matches (dentro de los tipos si hay filtros)
 *
 * @param {Fuse}     fuse
 * @param {string}   query
 * @param {Array}    todosLugares
 * @param {string[]} [tiposFiltro=[]]
 * @returns {Array} Lugares enriquecidos
 */
export function filtrarLugares(fuse, query, todosLugares, tiposFiltro = []) {
  const tiposSet = new Set(tiposFiltro);
  const hayFiltro = tiposSet.size > 0;
  const candidatos = hayFiltro
    ? todosLugares.filter((l) => tiposSet.has(l.tipo))
    : todosLugares;

  const q = normalizarQuery(query.trim());

  if (!q) {
    return hayFiltro ? candidatos : [];
  }

  const idsPermitidos = hayFiltro ? new Set(candidatos.map((c) => c.id)) : null;
  return fuse
    .search(q, { limit: hayFiltro ? 50 : MAX_RESULTADOS })
    .map((r) => r.item)
    .filter((item) => !idsPermitidos || idsPermitidos.has(item.id))
    .slice(0, MAX_RESULTADOS);
}

/**
 * Búsqueda difusa sin filtros de tipo (compatibilidad y tests).
 *
 * @param {Fuse}   fuse
 * @param {string} query
 * @param {Array}  todosLugares
 * @returns {Array} Lugares enriquecidos
 */
export function buscar(fuse, query, todosLugares) {
  return filtrarLugares(fuse, query, todosLugares, []);
}
