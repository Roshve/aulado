/**
 * mapRuta.js — helpers puros para la capa de ruta en Leaflet (Fase 4).
 */
import { pctALatLng, latlngAPct } from './leafletCoords.js';

/**
 * Convierte puntos % del segmento a coordenadas Leaflet [[lat, lng], ...].
 *
 * @param {Array<{ x: number, y: number }>} puntos
 * @returns {Array<[number, number]>}
 */
export function puntosALatLngs(puntos) {
  return puntos.map((p) => {
    const ll = pctALatLng(p);
    return [ll.lat, ll.lng];
  });
}

/**
 * Devuelve el segmento de la ruta que corresponde al piso dado.
 *
 * @param {{ ok?: boolean, segmentos?: Array }} ruta
 * @param {number} pisoNumero
 * @returns {object|null}
 */
export function segmentoEnPiso(ruta, pisoNumero) {
  if (!ruta?.ok || !ruta.segmentos) return null;
  return ruta.segmentos.find((s) => s.piso === pisoNumero) ?? null;
}

/**
 * Índice del segmento en la ruta para un piso dado.
 *
 * @param {{ ok?: boolean, segmentos?: Array }} ruta
 * @param {number} pisoNumero
 * @returns {number}
 */
export function indiceSegmentoEnPiso(ruta, pisoNumero) {
  if (!ruta?.ok || !ruta.segmentos) return -1;
  return ruta.segmentos.findIndex((s) => s.piso === pisoNumero);
}

/**
 * Texto contextual del segmento activo de la ruta.
 *
 * @param {object} seg
 * @param {{ nombre?: string }} origen
 * @param {{ nombre?: string }} destino
 * @returns {string}
 */
export function hintSegmento(seg, origen, destino) {
  if (!seg) return '';
  if (seg.esOrigen && seg.esDestino) {
    return `${origen?.nombre ?? 'Origen'} y ${destino?.nombre ?? 'Destino'} están en el mismo piso.`;
  }
  if (seg.esOrigen) {
    return `Estás en ${seg.etiqueta}. Caminá hasta el ascensor o escalera.`;
  }
  if (seg.esDestino) {
    return `Llegás a ${destino?.nombre ?? 'destino'} en ${seg.etiqueta}.`;
  }
  return `Piso de transición: ${seg.etiqueta}`;
}

/** Roundtrip helper exportado para tests. */
export { latlngAPct };
