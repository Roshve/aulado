/**
 * geo.js — utilidades de geolocalización (Fase 3).
 *
 * En Fase 3 se cablea esto con un botón "Cómo llegar" en DestinationCard.
 * Por ahora la función existe y está lista para ser importada.
 */

/**
 * Genera un link de Google Maps con dirección hacia las coordenadas de la entrada
 * del edificio. Abre la app de mapas del teléfono si está instalada.
 *
 * @param {{ lat: number, lng: number }} entrada - Coordenadas GPS de la entrada
 * @returns {string} URL de Google Maps
 */
export function linkDirecciones({ lat, lng }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Solicita la posición actual del usuario via Geolocation API.
 * Devuelve una Promise con { lat, lng } o lanza si el usuario deniega.
 *
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export function obtenerPosicion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no disponible en este navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}
