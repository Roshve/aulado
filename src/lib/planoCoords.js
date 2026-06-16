/**
 * planoCoords.js — conversión pantalla ↔ coordenadas % del plano (GraphEditor / CalibradorLugares).
 */

/**
 * Convierte coordenadas de pantalla a porcentaje sobre el plano (0–100).
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ wrapEl: HTMLElement, imgEl: HTMLImageElement, scale: number, offset: { x: number, y: number } }} opts
 * @returns {{ x: number, y: number } | null}
 */
export function screenToPercent(clientX, clientY, { wrapEl, imgEl, scale, offset }) {
  if (!wrapEl || !imgEl) return null;
  const wrapRect = wrapEl.getBoundingClientRect();
  const cx = clientX - wrapRect.left;
  const cy = clientY - wrapRect.top;
  const xPx = (cx - offset.x) / scale;
  const yPx = (cy - offset.y) / scale;
  const natW = wrapRect.width;
  const natH = natW * (imgEl.naturalHeight / imgEl.naturalWidth || 1);
  const x = Math.round((xPx / natW) * 1000) / 10;
  const y = Math.round((yPx / natH) * 1000) / 10;
  if (x < 0 || x > 100 || y < 0 || y > 100) return null;
  return { x, y };
}

/** Campos enriquecidos que no van en campus.json */
const CAMPUS_SKIP = new Set([
  'pisoNumero', 'pisoEtiqueta', 'planoPiso',
  'edificioId', 'edificioNombre', 'edificioApodos', 'edificioPisos', 'edificioEntrada',
  'aliasBusqueda',
]);

/**
 * Serializa lugares editables al formato del array `lugares` de campus.json.
 *
 * @param {Array<Object>} lugares
 * @returns {Array<Object>}
 */
export function serializarLugaresCampus(lugares) {
  return lugares.map((l) => {
    const out = {};
    for (const [key, val] of Object.entries(l)) {
      if (CAMPUS_SKIP.has(key)) continue;
      if (key === 'coord' && val) {
        out.coord = {
          x: Math.round(val.x * 10) / 10,
          y: Math.round(val.y * 10) / 10,
        };
      } else {
        out[key] = val;
      }
    }
    return out;
  });
}

/**
 * Posición CSS absoluta para un punto % sobre el plano.
 *
 * @param {{ x: number, y: number }} coord
 * @returns {import('preact').JSX.CSSProperties}
 */
export function posPct(coord) {
  return {
    position: 'absolute',
    left: `${coord.x}%`,
    top: `${coord.y}%`,
    transform: 'translate(-50%, -50%)',
  };
}
