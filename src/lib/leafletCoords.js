/**
 * leafletCoords.js — conversión entre coordenadas % (campus.json) y LatLng (Leaflet CRS.Simple).
 *
 * El sistema de coordenadas del campus usa porcentajes 0–100 con origen en la esquina
 * superior-izquierda y el eje Y apuntando hacia abajo (igual que CSS/SVG).
 * Leaflet CRS.Simple usa un plano cartesiano con Y hacia arriba, así que invertimos el eje Y.
 *
 * Conversión: pct { x, y } → LatLng { lat: 100 - y, lng: x }
 *
 * No importamos Leaflet aquí para que este módulo sea testeable en entorno node (vitest).
 * Los objetos { lat, lng } que devuelve son estructuralmente compatibles con L.LatLng:
 * Leaflet acepta arrays [lat, lng] y objetos { lat, lng } en todos sus métodos.
 *
 * Exporta:
 *   BOUNDS              → [[0,0],[100,100]] — sistema de referencia normalizado
 *   pctALatLng({x, y}) → { lat, lng }
 *   latlngAPct(latlng)  → { x, y }
 *   boundsParaPlano(pisoNumero) → BOUNDS  (punto único de cambio si los pisos difieren)
 */

/**
 * Bounds normalizados del sistema de referencia: toda la imagen ocupa 100×100 unidades.
 * Leaflet CRS.Simple los interpreta como [[latMin, lngMin], [latMax, lngMax]].
 * @type {[[number,number],[number,number]]}
 */
export const BOUNDS = [[0, 0], [100, 100]];

/**
 * Convierte una coordenada porcentual del campus a LatLng de Leaflet CRS.Simple.
 * El eje Y se invierte: Y=0 (arriba en imagen) → lat=100 (alto en CRS.Simple).
 *
 * @param {{ x: number, y: number }} coord - Coordenada porcentual (0–100)
 * @returns {{ lat: number, lng: number }} Compatible con L.LatLng y arrays [lat, lng]
 */
export function pctALatLng({ x, y }) {
  return { lat: 100 - y, lng: x };
}

/**
 * Convierte un LatLng de Leaflet CRS.Simple de vuelta a coordenada porcentual.
 *
 * @param {{ lat: number, lng: number }} latlng
 * @returns {{ x: number, y: number }}
 */
export function latlngAPct(latlng) {
  return { x: latlng.lng, y: 100 - latlng.lat };
}

/**
 * Devuelve los bounds del sistema de referencia para un piso dado.
 * Hoy todos los pisos usan el mismo sistema 0–100 normalizado.
 * Si en el futuro diferentes pisos tienen proporciones distintas, este es el único
 * lugar a modificar (ver ROADMAP "Notas de datos").
 *
 * @param {number} _pisoNumero - Número de piso (no usado aún)
 * @returns {[[number,number],[number,number]]}
 */
export function boundsParaPlano(_pisoNumero) {
  return BOUNDS;
}
