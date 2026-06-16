/**
 * mapPois.js — helpers puros para POIs del mapa (Fase 3).
 *
 * Sin dependencia de Leaflet: testeable en entorno node (vitest).
 */
import { getIconoTipo } from './campus.js';

/** Zoom mínimo para mostrar etiquetas de nombre (por debajo, solo icono). */
export const ZOOM_MIN_LABELS = 0;

/**
 * @param {number} zoom
 * @returns {boolean}
 */
export function mostrarLabelsEnZoom(zoom) {
  return zoom >= ZOOM_MIN_LABELS;
}

/**
 * Genera el HTML interno de un POI para L.divIcon.
 *
 * @param {{ id: string, nombre: string, tipo: string }} lugar
 * @param {{ mostrarLabel?: boolean, seleccionado?: boolean }} opciones
 * @returns {string}
 */
export function crearHtmlPoi(lugar, { mostrarLabel = true, seleccionado = false } = {}) {
  const icono = getIconoTipo(lugar.tipo);
  const clases = [
    'mapa-poi',
    seleccionado ? 'mapa-poi--seleccionado' : '',
    mostrarLabel ? '' : 'mapa-poi--sin-label',
  ].filter(Boolean).join(' ');

  return `<div class="${clases}" role="button" aria-label="${escapeAttr(lugar.nombre)}">
    <span class="mapa-poi__icono" aria-hidden="true">${icono}</span>
    <span class="mapa-poi__label">${escapeHtml(lugar.nombre)}</span>
  </div>`;
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {string} s */
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/** Altura aproximada del icono (px) para iconAnchor. */
export const POI_ICON_H = 44;
export const POI_ICON_W = 80;
