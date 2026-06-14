/**
 * favorites.js — persistencia de favoritos en localStorage (Fase 4).
 *
 * API simple que no depende de ningún framework.
 * En Fase 4 se conecta con un botón ★ en DestinationCard.
 */

const KEY = 'aulado:favoritos';

/**
 * Devuelve el Set de IDs de lugares marcados como favorito.
 * @returns {Set<string>}
 */
export function getFavoritos() {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/**
 * Agrega o quita un lugar de favoritos.
 * @param {string} id
 * @returns {boolean} true si quedó como favorito, false si se eliminó
 */
export function toggleFavorito(id) {
  const favs = getFavoritos();
  if (favs.has(id)) {
    favs.delete(id);
  } else {
    favs.add(id);
  }
  localStorage.setItem(KEY, JSON.stringify([...favs]));
  return favs.has(id);
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function esFavorito(id) {
  return getFavoritos().has(id);
}
