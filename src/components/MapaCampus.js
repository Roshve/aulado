/**
 * MapaCampus.js — lienzo persistente del mapa indoor (Leaflet CRS.Simple).
 *
 * Renderiza el plano del piso activo con pan/zoom nativo y capa de POIs clicables (Fase 3).
 *
 * Props:
 *   pisoActivo           {number}               — número de piso (-1, 0, 1, 2…)
 *   planoPiso            {string}               — URL del asset del plano
 *   centradoEn           {{x,y}|null}           — coord % a la que centrar el mapa
 *   lugares              {Array}                — lugares del piso activo
 *   lugarSeleccionadoId  {string|null}          — id del lugar resaltado
 *   onSeleccionLugar     {Function}             — callback(id) al tocar un POI
 *   segmentoRuta         {Object|null}          — segmento activo de la ruta (Fase 4)
 */
import { html } from 'htm/preact';
import { useRef } from 'preact/hooks';
import { useLeafletMap } from '../lib/useLeafletMap.js';

/**
 * @param {{ pisoActivo: number, planoPiso: string, centradoEn?: {x:number,y:number}|null, lugares?: Array, lugarSeleccionadoId?: string|null, onSeleccionLugar?: Function, segmentoRuta?: object|null }} props
 */
export function MapaCampus({
  pisoActivo,
  planoPiso,
  centradoEn,
  lugares = [],
  lugarSeleccionadoId = null,
  onSeleccionLugar,
  segmentoRuta = null,
}) {
  const containerRef = useRef(null);

  // eslint-disable-next-line no-unused-vars
  const _mapRef = useLeafletMap(containerRef, {
    pisoActivo,
    planoPiso,
    centradoEn,
    lugares,
    lugarSeleccionadoId,
    onSeleccionLugar,
    segmentoRuta,
  });

  return html`<div ref=${containerRef} class="mapa-campus" aria-label="Mapa del campus"></div>`;
}
