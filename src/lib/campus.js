/**
 * campus.js — helpers para recorrer e indexar el JSON del campus.
 *
 * Exporta:
 *   aplanarLugares(data)   → lista de "lugares enriquecidos" con refs al edificio y piso
 *   getLugarById(lista, id) → lugar enriquecido por su id
 *   getBreadcrumb(lugar)   → string legible "Edificio B · Piso 2 · aula"
 */

/**
 * Convierte el JSON jerárquico en una lista plana.
 * Cada elemento combina los campos del lugar con datos de su edificio y piso.
 *
 * @param {Object} data - JSON completo del campus
 * @returns {Array} Lista de lugares enriquecidos
 */
export function aplanarLugares(data) {
  const lista = [];
  for (const edificio of data.edificios) {
    for (const piso of edificio.pisos) {
      for (const lugar of piso.lugares) {
        lista.push({
          // Campos propios del lugar
          ...lugar,
          // Datos del piso
          pisoNumero: piso.numero,
          pisoEtiqueta: piso.etiqueta,
          planoPiso: piso.plano,
          // Datos del edificio
          edificioId: edificio.id,
          edificioNombre: edificio.nombre,
          edificioApodos: edificio.apodos,
          // Referencia completa para Fases 3+ (GPS a la entrada)
          edificioEntrada: edificio.entrada,
        });
      }
    }
  }
  return lista;
}

/**
 * Busca un lugar en la lista aplanada por su id.
 *
 * @param {Array} lista - Resultado de aplanarLugares
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getLugarById(lista, id) {
  return lista.find((l) => l.id === id);
}

/**
 * Genera un breadcrumb legible para mostrar en resultados y fichas.
 * Ejemplo: "Edificio B · Piso 2 · aula"
 *
 * @param {Object} lugar - Lugar enriquecido
 * @returns {string}
 */
export function getBreadcrumb(lugar) {
  return `${lugar.edificioNombre} · ${lugar.pisoEtiqueta} · ${lugar.tipo}`;
}

/**
 * Íconos por tipo de lugar (emoji simple, suficiente para el MVP).
 */
export const TIPO_ICONO = {
  aula: '🏫',
  oficina: '🏢',
  bano: '🚻',
  laboratorio: '🔬',
  biblioteca: '📚',
  cafeteria: '☕',
  default: '📍',
};

export function getIconoTipo(tipo) {
  return TIPO_ICONO[tipo] ?? TIPO_ICONO.default;
}
