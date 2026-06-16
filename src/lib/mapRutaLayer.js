/**
 * mapRutaLayer.js — capa Leaflet L.polyline para segmentos de ruta (Fase 4).
 */
import L from 'leaflet';
import { puntosALatLngs } from './mapRuta.js';

/**
 * Crea una capa con la polyline del segmento activo.
 *
 * @param {import('leaflet').Map} map
 * @param {{ puntos?: Array<{x:number,y:number}> }|null} segmento
 * @returns {{ layerGroup: import('leaflet').LayerGroup, destroy: () => void }}
 */
export function crearCapaRuta(map, segmento) {
  const layerGroup = L.layerGroup();

  if (segmento?.puntos?.length >= 2) {
    const latlngs = puntosALatLngs(segmento.puntos);
    const polyline = L.polyline(latlngs, {
      color: '#4285F4',
      weight: 4,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: '8 6',
      className: 'mapa-ruta-line',
    });
    polyline.addTo(layerGroup);

    try {
      map.fitBounds(polyline.getBounds(), { padding: [20, 20], maxZoom: 2 });
    } catch {
      /* bounds inválidos con puntos colapsados */
    }
  }

  function destroy() {
    layerGroup.clearLayers();
  }

  return { layerGroup, destroy };
}
