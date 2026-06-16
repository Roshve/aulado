/**
 * useLeafletMap.js — hook de Preact para montar y gestionar un mapa Leaflet CRS.Simple.
 *
 * Recibe una ref al elemento contenedor y los datos del piso activo.
 * Crea el mapa una sola vez al montar; al cambiar planoPiso reemplaza el ImageOverlay
 * preservando zoom y posición. Hace cleanup completo al desmontar.
 *
 * Uso:
 *   const mapRef = useRef(null);
 *   useLeafletMap(mapRef, { pisoActivo: -1, planoPiso: '/aulado/planos/subsuelo.png' });
 *
 * @returns {import('preact/hooks').Ref<import('leaflet').Map | null>} ref al objeto L.Map
 */
import { useEffect, useRef } from 'preact/hooks';
import L from 'leaflet';
import { BOUNDS, pctALatLng } from './leafletCoords.js';
import { crearMarcadoresPoi } from './mapPoiLayer.js';
import { crearCapaRuta } from './mapRutaLayer.js';

// Corrige la ruta de los iconos por defecto de Leaflet cuando se empaqueta con Vite.
// Leaflet intenta reconstruir la URL de los marcadores desde import.meta.url de su bundle,
// lo que falla en producción. Este patch reemplaza la iconImage por defecto.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

/**
 * Hook que monta un mapa Leaflet CRS.Simple sobre el elemento referenciado.
 *
 * @param {import('preact').RefObject<HTMLElement>} containerRef - Ref al div contenedor
 * @param {{ pisoActivo: number, planoPiso: string, centradoEn?: {x:number,y:number}|null, lugares?: Array, lugarSeleccionadoId?: string|null, onSeleccionLugar?: Function, segmentoRuta?: object|null }} opciones
 * @returns {import('preact').RefObject<import('leaflet').Map | null>}
 */
export function useLeafletMap(containerRef, {
  pisoActivo,
  planoPiso,
  centradoEn,
  lugares = [],
  lugarSeleccionadoId = null,
  onSeleccionLugar,
  segmentoRuta = null,
}) {
  // Ref que expone el objeto L.Map a quien llame al hook (p. ej. para añadir capas en Fase 3).
  const mapRef = useRef(null);
  // Ref interna al ImageOverlay activo, para poder reemplazarlo al cambiar de piso.
  const overlayRef = useRef(null);
  const poiApiRef = useRef(null);
  const rutaApiRef = useRef(null);
  const onSeleccionRef = useRef(onSeleccionLugar);
  onSeleccionRef.current = onSeleccionLugar;

  // ── Montar el mapa (una sola vez) ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      attributionControl: false,
      zoomControl: false,
      minZoom: -2,
      maxZoom: 4,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Mostrar toda la imagen al inicio
    map.fitBounds(BOUNDS);
    map.setMaxBounds(BOUNDS);

    // Primer overlay con el planoPiso inicial
    if (planoPiso) {
      const overlay = L.imageOverlay(planoPiso, BOUNDS).addTo(map);
      overlayRef.current = overlay;
    }

    mapRef.current = map;

    // Cleanup al desmontar el componente
    return () => {
      rutaApiRef.current?.destroy();
      rutaApiRef.current = null;
      poiApiRef.current?.destroy();
      poiApiRef.current = null;
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← solo al montar; los cambios de piso los gestiona el efecto de abajo

  // ── Actualizar el ImageOverlay al cambiar de piso ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !planoPiso) return;

    // Preservar zoom y centro antes de reemplazar el overlay
    const center = map.getCenter();
    const zoom = map.getZoom();

    // Quitar overlay anterior y añadir el nuevo
    if (overlayRef.current) {
      overlayRef.current.remove();
    }
    const nuevoOverlay = L.imageOverlay(planoPiso, BOUNDS).addTo(map);
    overlayRef.current = nuevoOverlay;

    // Restaurar posición (setView no ejecuta fitBounds, preserva el contexto)
    map.setView(center, zoom);
  }, [planoPiso, pisoActivo]);

  // ── Capa POIs al cambiar piso o lugares ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    poiApiRef.current?.destroy();
    poiApiRef.current = null;

    if (!lugares.length || !onSeleccionRef.current) return;

    const api = crearMarcadoresPoi(map, lugares, {
      onSeleccionLugar: (id) => onSeleccionRef.current?.(id),
      lugarSeleccionadoId,
    });
    api.layerGroup.addTo(map);
    poiApiRef.current = api;

    return () => {
      api.destroy();
      if (poiApiRef.current === api) poiApiRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pisoActivo, lugares]);

  // ── Resaltar POI seleccionado ──────────────────────────────────────────────
  useEffect(() => {
    poiApiRef.current?.actualizarSeleccion(lugarSeleccionadoId);
  }, [lugarSeleccionadoId]);

  // ── Capa de ruta (polyline del segmento activo) ───────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    rutaApiRef.current?.destroy();
    rutaApiRef.current = null;

    if (!segmentoRuta) return;

    const api = crearCapaRuta(map, segmentoRuta);
    api.layerGroup.addTo(map);
    rutaApiRef.current = api;

    return () => {
      api.destroy();
      if (rutaApiRef.current === api) rutaApiRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentoRuta]);

  // ── Centrar el mapa cuando cambia centradoEn ──────────────────────────────
  // Las primitivas x/y evitan re-centrado infinito causado por literales nuevos en cada render.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !centradoEn) return;
    map.setView(pctALatLng(centradoEn), Math.max(map.getZoom(), 1));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centradoEn?.x, centradoEn?.y]);

  return mapRef;
}
