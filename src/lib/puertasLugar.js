/**
 * puertasLugar.js — normaliza puerta singular vs puertas[] en campus.json.
 */

/** @typedef {{ x: number, y: number, join?: string }} Puerta */

/**
 * @param {{ puerta?: Puerta, puertas?: Puerta[] }} lugar
 * @returns {Puerta[]}
 */
export function puertasDe(lugar) {
  if (Array.isArray(lugar.puertas) && lugar.puertas.length > 0) {
    return lugar.puertas.map((p) => ({ ...p }));
  }
  if (lugar.puerta) return [{ ...lugar.puerta }];
  return [];
}

/**
 * @param {Puerta[]} puertas
 * @returns {{ puerta?: Puerta, puertas?: Puerta[] }}
 */
export function serializarPuertas(puertas) {
  if (!puertas.length) return {};
  if (puertas.length === 1) return { puerta: { ...puertas[0] } };
  return { puertas: puertas.map((p) => ({ ...p })) };
}

/**
 * @param {{ puerta?: Puerta, puertas?: Puerta[] }} lugar
 * @returns {{ puerta?: Puerta, puertas?: Puerta[] }}
 */
export function clonarPuertasCampo(lugar) {
  return serializarPuertas(puertasDe(lugar));
}

/** Id de nodo routing para la puerta i (0-based). */
export function idNodoPuerta(lugarId, indice = 0) {
  return indice === 0 ? `puerta-${lugarId}` : `puerta-${lugarId}-${indice + 1}`;
}

/** Id de nodo join intermedio. */
export function idNodoJoin(lugarId, indice = 0) {
  return indice === 0 ? `j-${lugarId}` : `j-${lugarId}-${indice + 1}`;
}

/** Etiqueta en el editor (s-06 · s-06·2). */
export function etiquetaPuerta(lugarId, indice, total) {
  return total > 1 ? `${lugarId}·${indice + 1}` : lugarId;
}
