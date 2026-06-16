/**
 * planosRegistry.js — metadatos de pisos derivados de campus.json.
 */

const PREFIJOS_NODO = {
  '-1': 's-n',
  0: 'n',
  1: 'p1-n',
  2: 'p2-n',
};

/** Prefijo de ID para nodos nuevos en un piso. */
export function prefijoNodo(pisoNumero) {
  if (PREFIJOS_NODO[String(pisoNumero)] !== undefined) {
    return PREFIJOS_NODO[String(pisoNumero)];
  }
  const n = Number(pisoNumero);
  if (n > 0) return `p${n}-n`;
  return `f${n}-n`;
}

/**
 * @param {Array<{numero: number, etiqueta: string, plano: string}>} pisos
 * @param {number} numero
 */
export function getPisoInfo(pisos, numero) {
  return pisos.find((p) => p.numero === numero) ?? null;
}

/** Slug para nombres de archivo de export (p. ej. planta-baja). */
export function slugPiso(etiqueta, numero) {
  const slug = etiqueta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || `piso-${numero}`;
}

/** Nombre sugerido del overlay de verificación por piso. */
export function overlayVerificacionSlug(numero, etiqueta) {
  const nombres = {
    '-1': 'subsuelo',
    0: 'planta-baja',
    1: 'primer-piso',
    2: 'segundo-piso',
  };
  return nombres[String(numero)] ?? slugPiso(etiqueta ?? '', numero);
}
