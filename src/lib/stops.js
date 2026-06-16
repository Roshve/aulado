/**
 * stops.js — lista de paradas (mini-itinerario temporal).
 *
 * Persistencia en localStorage. Lista ordenada de hasta MAX_PARADAS IDs.
 * Sigue el mismo patrón que favorites.js y recents.js.
 */

const KEY = 'aulado:paradas';
const MAX_PARADAS = 12;

/**
 * Devuelve el array de IDs de paradas (en el orden en que se agregaron).
 * @returns {string[]}
 */
export function getParadasIds() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Resuelve los IDs de paradas a objetos de lugar.
 * @param {string[]} ids
 * @param {Array} todosLugares
 * @returns {Array}
 */
export function resolverParadas(ids, todosLugares) {
  return ids.map((id) => todosLugares.find((l) => l.id === id)).filter(Boolean);
}

/**
 * Devuelve la lista de paradas ya resuelta a objetos de lugar.
 * @param {Array} todosLugares
 * @returns {Array}
 */
export function getParadas(todosLugares) {
  return resolverParadas(getParadasIds(), todosLugares);
}

/**
 * Retorna true si el ID está en la lista de paradas.
 * @param {string} id
 * @returns {boolean}
 */
export function esParada(id) {
  return getParadasIds().includes(id);
}

/**
 * Agrega un ID al final de la lista (deduplicando). Máximo MAX_PARADAS.
 * @param {string} id
 * @param {Array} todosLugares
 * @returns {Array} lista actualizada de objetos de lugar
 */
export function agregarParada(id, todosLugares) {
  const ids = getParadasIds().filter((i) => i !== id);
  ids.push(id);
  const acotados = ids.slice(0, MAX_PARADAS);
  localStorage.setItem(KEY, JSON.stringify(acotados));
  return resolverParadas(acotados, todosLugares);
}

/**
 * Quita un ID de la lista de paradas.
 * @param {string} id
 * @param {Array} todosLugares
 * @returns {Array} lista actualizada de objetos de lugar
 */
export function quitarParada(id, todosLugares) {
  const ids = getParadasIds().filter((i) => i !== id);
  localStorage.setItem(KEY, JSON.stringify(ids));
  return resolverParadas(ids, todosLugares);
}

/**
 * Elimina todas las paradas del localStorage.
 */
export function limpiarParadas() {
  localStorage.removeItem(KEY);
}
