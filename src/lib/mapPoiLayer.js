/**
 * mapPoiLayer.js — factory Leaflet para la capa de POIs (Fase 3).
 */
import L from 'leaflet';
import { pctALatLng } from './leafletCoords.js';
import {
  crearHtmlPoi,
  mostrarLabelsEnZoom,
  POI_ICON_H,
  POI_ICON_W,
} from './mapPois.js';

/**
 * Crea una capa L.layerGroup con markers POI para los lugares dados.
 *
 * @param {import('leaflet').Map} map
 * @param {Array<{ id: string, nombre: string, tipo: string, coord: { x: number, y: number } }>} lugares
 * @param {{ onSeleccionLugar: (id: string) => void, lugarSeleccionadoId?: string|null }} opciones
 * @returns {{ layerGroup: import('leaflet').LayerGroup, actualizarLabels: () => void, actualizarSeleccion: (id: string|null) => void, destroy: () => void }}
 */
export function crearMarcadoresPoi(map, lugares, { onSeleccionLugar, lugarSeleccionadoId = null }) {
  const layerGroup = L.layerGroup();
  /** @type {Map<string, import('leaflet').Marker>} */
  const markersPorId = new Map();
  let seleccionadoId = lugarSeleccionadoId;

  const mostrarLabel = mostrarLabelsEnZoom(map.getZoom());

  for (const lugar of lugares) {
    if (!lugar.coord) continue;

    const icon = L.divIcon({
      className: 'mapa-poi-wrap',
      html: crearHtmlPoi(lugar, {
        mostrarLabel,
        seleccionado: lugar.id === seleccionadoId,
      }),
      iconSize: [POI_ICON_W, POI_ICON_H],
      iconAnchor: [POI_ICON_W / 2, POI_ICON_H],
    });

    const marker = L.marker(pctALatLng(lugar.coord), { icon });
    marker.on('click', () => onSeleccionLugar(lugar.id));
    marker.addTo(layerGroup);
    markersPorId.set(lugar.id, marker);
  }

  function actualizarLabels() {
    const show = mostrarLabelsEnZoom(map.getZoom());
    for (const marker of markersPorId.values()) {
      const el = marker.getElement()?.querySelector('.mapa-poi');
      if (!el) continue;
      el.classList.toggle('mapa-poi--sin-label', !show);
    }
  }

  function actualizarSeleccion(id) {
    for (const [markerId, marker] of markersPorId) {
      const el = marker.getElement()?.querySelector('.mapa-poi');
      if (!el) continue;
      el.classList.toggle('mapa-poi--seleccionado', markerId === id);
    }
    seleccionadoId = id;
  }

  function onZoomEnd() {
    actualizarLabels();
  }

  map.on('zoomend', onZoomEnd);

  function destroy() {
    map.off('zoomend', onZoomEnd);
    layerGroup.clearLayers();
    markersPorId.clear();
  }

  return { layerGroup, actualizarLabels, actualizarSeleccion, destroy };
}
