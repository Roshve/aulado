/**
 * search.js — búsqueda difusa sobre la lista de lugares del campus.
 *
 * Usa Fuse.js con keys sobre nombre, sinónimos, tipo y datos del edificio.
 * Normaliza el query (lowercase + sin acentos) antes de buscar.
 *
 * Exporta:
 *   crearBuscador(lugares)   → instancia de Fuse lista para usar
 *   buscar(fuse, query)      → Array de lugares enriquecidos (máx. MAX_RESULTADOS)
 *   normalizarQuery(query)   → string normalizado (uso interno, exportado para tests)
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
    .replace(/[̀-ͯ]/g, ''); // elimina marcas diacríticas
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
    ignoreLocation: true,       // no penaliza posición del match
    getFn: (obj, path) => {
      // Fuse llama getFn para extraer el valor. Normalizamos aquí para que
      // la comparación ya trabaje sobre strings sin acentos.
      const val = Fuse.config.getFn(obj, path);
      if (Array.isArray(val)) return val.map(normalizarQuery);
      if (typeof val === 'string') return normalizarQuery(val);
      return val ?? '';
    },
  });
}

/**
 * Ejecuta la búsqueda y devuelve hasta MAX_RESULTADOS lugares enriquecidos.
 * Con query vacío devuelve todos los lugares (útil para mostrar sugerencias).
 *
 * @param {Fuse}   fuse
 * @param {string} query
 * @param {Array}  todosLugares - lista original, para devolver todos si query vacío
 * @returns {Array} Lugares enriquecidos
 */
export function buscar(fuse, query, todosLugares) {
  const q = normalizarQuery(query.trim());
  if (!q) return todosLugares.slice(0, MAX_RESULTADOS);
  return fuse
    .search(q, { limit: MAX_RESULTADOS })
    .map((r) => r.item);
}
