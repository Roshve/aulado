/**
 * urlState.js — serialización del estado de búsqueda en la URL (query string).
 *
 * Permite compartir y recargar una búsqueda con sus filtros activos.
 * Se usa `location.search` (?q=...&tipos=...) para no interferir con el hash
 * de routing (#/lugar/:id, #/plano/:id alias, #/ruta/..., #/anotar/:piso).
 */

/**
 * Lee los parámetros de búsqueda de la URL.
 * Acepta un string de query opcional para facilitar los tests.
 * @param {string} [search=location.search]
 * @returns {{ q: string, tipos: string[] }}
 */
export function parseSearchParams(search = location.search) {
  const params = new URLSearchParams(search);
  const q = params.get('q') || '';
  const tiposRaw = params.get('tipos') || '';
  const tipos = tiposRaw
    ? tiposRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : [];
  return { q, tipos };
}

/**
 * Serializa el estado de búsqueda a un query string.
 * Omite claves con valores vacíos.
 * @param {string} q
 * @param {string[]} tipos
 * @returns {string} e.g. "?q=aula&tipos=aula,laboratorio" o "" si todo vacío
 */
export function serializeSearch(q, tipos) {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (tipos.length) params.set('tipos', tipos.join(','));
  const s = params.toString();
  return s ? `?${s}` : '';
}
