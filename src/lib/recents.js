/**
 * recents.js — lista de lugares vistos recientemente (Fase E).
 *
 * Persistencia en localStorage. Lista FIFO de hasta MAX_RECIENTES IDs.
 * Sigue el mismo patrón que favorites.js.
 */

const KEY = 'aulado:recientes';
const MAX_RECIENTES = 8;

/**
 * Devuelve el array de IDs visitados recientemente (más reciente primero).
 * @returns {string[]}
 */
export function getRecientesIds() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Agrega un ID al principio de la lista, deduplicando y limitando el tamaño.
 * @param {string} id
 * @param {Array} todosLugares - para resolver los objetos de lugar
 * @returns {Array} lista de lugares enriquecidos recientes
 */
export function agregarReciente(id, todosLugares) {
  const ids = getRecientesIds().filter((i) => i !== id);
  ids.unshift(id);
  const acotados = ids.slice(0, MAX_RECIENTES);
  localStorage.setItem(KEY, JSON.stringify(acotados));
  return resolverRecientes(acotados, todosLugares);
}

/**
 * Resuelve los IDs recientes a objetos de lugar.
 * @param {string[]} ids
 * @param {Array} todosLugares
 * @returns {Array}
 */
export function resolverRecientes(ids, todosLugares) {
  return ids
    .map((id) => todosLugares.find((l) => l.id === id))
    .filter(Boolean);
}

/**
 * Devuelve la lista de lugares recientes ya resuelta.
 * @param {Array} todosLugares
 * @returns {Array}
 */
export function getRecientes(todosLugares) {
  return resolverRecientes(getRecientesIds(), todosLugares);
}
