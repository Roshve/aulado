/**
 * campus.js — helpers para recorrer e indexar el JSON del campus.
 *
 * Exporta:
 *   resolveAsset(path)     → ruta pública resuelta contra el base de Vite
 *   aplanarLugares(data)   → lista de "lugares enriquecidos" con refs al edificio y piso
 *   getLugarById(lista, id) → lugar enriquecido por su id
 *   getBreadcrumb(lugar)   → string legible "Edificio B · Piso 2 · aula"
 */

/**
 * Resuelve una ruta de asset público contra el base de Vite (p. ej. "/aulado/").
 * Las rutas del JSON son absolutas desde la raíz (/planos/...) pero Vite no las
 * procesa en tiempo de ejecución, así que hay que prefijarlas manualmente.
 *
 * @param {string} path - Ruta absoluta del asset, ej. "/planos/subsuelo.png"
 * @returns {string} URL lista para usar en src/href
 */
export function resolveAsset(path) {
  if (!path) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, ''); // "/aulado"
  return base + (path.startsWith('/') ? path : `/${path}`);
}

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
    // Lista resumida de pisos del edificio (metadata enriquecida por lugar)
    const edificioPisos = edificio.pisos.map((p) => ({
      numero: p.numero,
      etiqueta: p.etiqueta,
      plano: resolveAsset(p.plano),
    }));

    for (const piso of edificio.pisos) {
      for (const lugar of piso.lugares) {
        lista.push({
          // Campos propios del lugar
          ...lugar,
          // Datos del piso
          pisoNumero: piso.numero,
          pisoEtiqueta: piso.etiqueta,
          planoPiso: resolveAsset(piso.plano),
          // Datos del edificio
          edificioId: edificio.id,
          edificioNombre: edificio.nombre,
          edificioApodos: edificio.apodos,
          edificioPisos,                  // ← todos los pisos del edificio (Fase C)
          // Referencia completa para GPS a la entrada
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
  auditorio: '🎭',
  servicio: '🛠️',
  acceso: '🚪',
  default: '📍',
};

export function getIconoTipo(tipo) {
  return TIPO_ICONO[tipo] ?? TIPO_ICONO.default;
}

/**
 * Devuelve la lista de pisos del campus ordenada por número ascendente,
 * con el plano resuelto contra el base de Vite.
 *
 * @param {Object} data - JSON completo del campus
 * @returns {Array<{numero: number, etiqueta: string, plano: string}>}
 */
export function listarPisos(data) {
  const pisos = [];
  for (const edificio of data.edificios) {
    for (const piso of edificio.pisos) {
      pisos.push({
        numero: piso.numero,
        etiqueta: piso.etiqueta,
        plano: resolveAsset(piso.plano),
      });
    }
  }
  return pisos.sort((a, b) => a.numero - b.numero);
}

/**
 * Dado un array de pisos (resultado de listarPisos) y un número de piso,
 * devuelve la URL resuelta del plano, o undefined si no existe.
 *
 * @param {Array<{numero: number, plano: string}>} pisos
 * @param {number} numero
 * @returns {string|undefined}
 */
export function getPlanoPorPiso(pisos, numero) {
  return pisos.find((p) => p.numero === numero)?.plano;
}
