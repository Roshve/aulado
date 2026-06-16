/**
 * App.js — shell map-first.
 *
 * MapaCampus es el lienzo persistente. Búsqueda, ficha y ruta flotan como overlays.
 * EditorCampus (#/editar, alias #/anotar / #/calibrar) es capa full-screen dev.
 *
 * estadoSheet: 'resultados' | 'ficha' | 'ruta'
 * vistaEditor: null | 'editar' | 'anotar' | 'calibrar'
 */
import { html } from 'htm/preact';
import { useState, useMemo, useEffect } from 'preact/hooks';

import campusData from '../data/campus.json';
import grafoData  from '../data/grafo.json';
import { aplanarLugares, getLugarById, listarPisos, getPlanoPorPiso } from '../lib/campus.js';
import { crearBuscador, agregarAliasBusqueda } from '../lib/search.js';
import { getFavoritos, toggleFavorito } from '../lib/favorites.js';
import { agregarReciente, getRecientes } from '../lib/recents.js';
import { getParadas, agregarParada, quitarParada, limpiarParadas, esParada } from '../lib/stops.js';
import { parseSearchParams, serializeSearch } from '../lib/urlState.js';
import { construirGrafo, calcularRuta } from '../lib/routing.js';
import { indiceSegmentoEnPiso } from '../lib/mapRuta.js';
import { MapaCampus }     from './MapaCampus.js';
import { SearchOverlay }  from './SearchOverlay.js';
import { SelectorPiso }   from './SelectorPiso.js';
import { BottomSheet }    from './BottomSheet.js';
import { DestinationCard } from './DestinationCard.js';
import { RutaPanel }      from './RutaPanel.js';
import { EditorCampus, tabDesdeVista, resolverPisoEditor } from './EditorCampus.js';

// Preparar datos una sola vez (fuera del componente: no recalcular en cada render).
const todosLugares = aplanarLugares(campusData).map(agregarAliasBusqueda);
const fuse         = crearBuscador(todosLugares);
const pisos        = listarPisos(campusData);

/** ID del origen por defecto: Hall de Entrada */
const ORIGEN_DEFAULT_ID = 'pb-hall';
const STORAGE_MODO_ACCESIBLE = 'aulado-modo-accesible';

function leerModoAccesible() {
  try {
    return localStorage.getItem(STORAGE_MODO_ACCESIBLE) === '1';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// Hash routing helpers
// ─────────────────────────────────────────────────────────────────

function parseHash() {
  const hash = location.hash;
  // #/plano/:id es alias retrocompatible de #/lugar/:id (ambos abren ficha)
  const mLugar = hash.match(/^#\/(lugar|plano)\/(.+)$/);
  if (mLugar) {
    return { vista: mLugar[1] === 'plano' ? 'plano' : 'ficha', id: mLugar[2] };
  }
  const mRuta = hash.match(/^#\/ruta\/([^/]+)\/(.+)$/);
  if (mRuta) {
    return { vista: 'ruta', origenId: mRuta[1], id: mRuta[2] };
  }
  const mEditar = hash.match(/^#\/editar\/(-?\d+)$/);
  if (mEditar) {
    return { vista: 'editar', piso: parseInt(mEditar[1], 10) };
  }
  const mAnotar = hash.match(/^#\/anotar\/(-?\d+)$/);
  if (mAnotar) {
    return { vista: 'anotar', piso: parseInt(mAnotar[1], 10) };
  }
  const mCalibrar = hash.match(/^#\/calibrar\/(-?\d+)$/);
  if (mCalibrar) {
    return { vista: 'calibrar', piso: parseInt(mCalibrar[1], 10) };
  }
  return null;
}

function pushHash(vistaDestino, lugar, origenId) {
  const search = location.search;
  if (!lugar) {
    history.pushState(null, '', location.pathname + search);
    return;
  }
  let hash;
  if (vistaDestino === 'ruta') {
    hash = `#/ruta/${origenId ?? ORIGEN_DEFAULT_ID}/${lugar.id}`;
  } else if (vistaDestino === 'ficha') {
    hash = `#/lugar/${lugar.id}`;
  } else {
    hash = `#/lugar/${lugar.id}`;
  }
  history.pushState(null, '', `${location.pathname}${search}${hash}`);
}

// ─────────────────────────────────────────────────────────────────
// Componente raíz
// ─────────────────────────────────────────────────────────────────

export function App() {
  const [pisoActivo,       setPisoActivo]       = useState(0);
  const [lugarSeleccionado, setLugarSeleccionado] = useState(null);
  const [estadoSheet,      setEstadoSheet]      = useState('resultados'); // 'resultados'|'ficha'|'ruta'
  const [vistaEditor,      setVistaEditor]      = useState(null);         // null|'editar'|'anotar'|'calibrar'
  const [favoritos,        setFavoritos]        = useState(() => getFavoritos());
  const [recientes,        setRecientes]        = useState(() => getRecientes(todosLugares));
  const [paradas,          setParadas]          = useState(() => getParadas(todosLugares));
  const [rutaOrigenId,     setRutaOrigenId]     = useState(ORIGEN_DEFAULT_ID);
  const [editorPiso,       setEditorPiso]       = useState(null);
  const [modoAccesible,    setModoAccesible]    = useState(leerModoAccesible);
  const [segmentoRutaIdx, setSegmentoRutaIdx] = useState(0);

  function handleModoAccesible(activo) {
    setModoAccesible(activo);
    try {
      localStorage.setItem(STORAGE_MODO_ACCESIBLE, activo ? '1' : '0');
    } catch { /* storage no disponible */ }
  }

  // ── Hidratar desde hash al montar + popstate ───────────────────
  function aplicarHash(parsed) {
    if (!parsed) {
      setEstadoSheet('resultados');
      setLugarSeleccionado(null);
      setVistaEditor(null);
      setEditorPiso(null);
      return;
    }
    if (parsed.vista === 'editar' || parsed.vista === 'anotar' || parsed.vista === 'calibrar') {
      setVistaEditor(parsed.vista);
      setEditorPiso(parsed.piso);
      return;
    }
    const lugar = getLugarById(todosLugares, parsed.id);
    if (lugar) {
      setLugarSeleccionado(lugar);
      setPisoActivo(lugar.pisoNumero);
      if (parsed.vista === 'ruta') {
        setEstadoSheet('ruta');
        setVistaEditor(null);
        if (parsed.origenId) setRutaOrigenId(parsed.origenId);
      } else {
        setEstadoSheet('ficha');
        setVistaEditor(null);
      }
    }
  }

  useEffect(() => {
    aplicarHash(parseHash());

    const onPop = () => aplicarHash(parseHash());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derivados ─────────────────────────────────────────────────
  const planoPiso   = getPlanoPorPiso(pisos, pisoActivo);
  const centradoEn  = lugarSeleccionado?.coord ?? null;

  const lugaresDelPiso = useMemo(
    () => todosLugares.filter((l) => l.pisoNumero === pisoActivo),
    [pisoActivo],
  );

  const rutaOrigen = useMemo(
    () => getLugarById(todosLugares, rutaOrigenId) ?? getLugarById(todosLugares, ORIGEN_DEFAULT_ID),
    [rutaOrigenId],
  );

  const grafo = useMemo(
    () => construirGrafo(grafoData, todosLugares, { modoAccesible }),
    [modoAccesible],
  );

  const ruta = useMemo(() => {
    if (estadoSheet !== 'ruta' || !lugarSeleccionado) return null;
    return calcularRuta(rutaOrigenId, lugarSeleccionado.id, grafo);
  }, [estadoSheet, lugarSeleccionado, rutaOrigenId, grafo]);

  const segmentoRuta = useMemo(() => {
    if (estadoSheet !== 'ruta' || !ruta?.ok) return null;
    return ruta.segmentos[segmentoRutaIdx] ?? null;
  }, [estadoSheet, ruta, segmentoRutaIdx]);

  // Al entrar en ruta o recalcular: volver al primer segmento y su piso
  useEffect(() => {
    if (estadoSheet !== 'ruta' || !ruta?.ok) return;
    setSegmentoRutaIdx(0);
    setPisoActivo(ruta.segmentos[0].piso);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoSheet, ruta?.ok, rutaOrigenId, modoAccesible, lugarSeleccionado?.id]);

  // ── Handlers ──────────────────────────────────────────────────

  function handleSeleccion(lugar) {
    setLugarSeleccionado(lugar);
    setEstadoSheet('ficha');
    setPisoActivo(lugar.pisoNumero);
    setVistaEditor(null);
    pushHash('ficha', lugar);
    setRecientes(agregarReciente(lugar.id, todosLugares));
  }

  function handleSeleccionLugar(id) {
    const lugar = getLugarById(todosLugares, id);
    if (lugar) handleSeleccion(lugar);
  }

  function handleCerrarFicha() {
    setEstadoSheet('resultados');
    setLugarSeleccionado(null);
    history.pushState(null, '', location.pathname + location.search);
  }

  function handleComoLlegar() {
    setEstadoSheet('ruta');
    pushHash('ruta', lugarSeleccionado, rutaOrigenId);
  }

  function handleCerrarRuta() {
    setEstadoSheet('ficha');
    pushHash('ficha', lugarSeleccionado);
  }

  function handleCambiarOrigen(id) {
    setRutaOrigenId(id);
    pushHash('ruta', lugarSeleccionado, id);
  }

  function handleSalirEditor() {
    setVistaEditor(null);
    setEditorPiso(null);
    history.pushState(null, '', location.pathname + location.search);
  }

  function handleCambioPisoEditor(numero) {
    const vista = vistaEditor === 'calibrar' ? 'calibrar' : vistaEditor === 'anotar' ? 'anotar' : 'editar';
    setEditorPiso(numero);
    history.replaceState(null, '', `${location.pathname}${location.search}#/${vista}/${numero}`);
  }

  function handleCambioPiso(numero) {
    setPisoActivo(numero);
    if (estadoSheet === 'ruta' && ruta?.ok) {
      const idx = indiceSegmentoEnPiso(ruta, numero);
      if (idx >= 0) setSegmentoRutaIdx(idx);
    }
  }

  function handleVerPisoSiguiente() {
    if (!ruta?.ok) return;
    const next = segmentoRutaIdx + 1;
    if (next >= ruta.segmentos.length) return;
    setSegmentoRutaIdx(next);
    setPisoActivo(ruta.segmentos[next].piso);
  }

  function handleIrASegmento(i) {
    if (!ruta?.ok || !ruta.segmentos[i]) return;
    setSegmentoRutaIdx(i);
    setPisoActivo(ruta.segmentos[i].piso);
  }

  function handleSearchSync(q, tipos) {
    const search = serializeSearch(q, tipos);
    history.replaceState(null, '', location.pathname + search + location.hash);
  }

  function handleToggleFavorito(id) {
    toggleFavorito(id);
    setFavoritos(getFavoritos());
  }

  function handleToggleParada(id) {
    if (esParada(id)) {
      setParadas(quitarParada(id, todosLugares));
    } else {
      setParadas(agregarParada(id, todosLugares));
    }
  }

  function handleLimpiarParadas() {
    limpiarParadas();
    setParadas([]);
  }

  // ── Render ────────────────────────────────────────────────────

  return html`
    <div class="app-shell">
      <${MapaCampus}
        pisoActivo=${pisoActivo}
        planoPiso=${planoPiso}
        centradoEn=${centradoEn}
        lugares=${lugaresDelPiso}
        lugarSeleccionadoId=${lugarSeleccionado?.id ?? null}
        onSeleccionLugar=${handleSeleccionLugar}
        segmentoRuta=${estadoSheet === 'ruta' ? segmentoRuta : null}
      />

      <!-- Cabecera de navegación (visible solo en desktop vía CSS) -->
      <div class=${'sidebar-ruta-header' + (estadoSheet === 'ficha' || estadoSheet === 'ruta' ? ' search-overlay--oculto' : '')}>
        <div class="sidebar-ruta-row">
          <span class="sidebar-ruta-icon">📍</span>
          <span class="sidebar-ruta-info">
            <span class="sidebar-ruta-label">Donde estoy</span>
            <span class="sidebar-ruta-nombre">${rutaOrigen?.nombre ?? 'Hall de Entrada'}</span>
          </span>
        </div>
        <div class="sidebar-ruta-conector"></div>
        <div class="sidebar-ruta-row">
          <span class="sidebar-ruta-icon">🎯</span>
          <span class="sidebar-ruta-info">
            <span class="sidebar-ruta-label">Adonde voy</span>
            <span class="sidebar-ruta-nombre" style="color:var(--color-text-muted);font-weight:400">
              Buscar destino abajo
            </span>
          </span>
        </div>
      </div>

      <${SearchOverlay}
        todosLugares=${todosLugares}
        fuse=${fuse}
        onSeleccion=${handleSeleccion}
        favoritos=${favoritos}
        recientes=${recientes}
        paradas=${paradas}
        onToggleParada=${handleToggleParada}
        onLimpiarParadas=${handleLimpiarParadas}
        searchInicial=${parseSearchParams()}
        onSearchSync=${handleSearchSync}
        oculto=${estadoSheet === 'ficha' || estadoSheet === 'ruta'}
      />

      <${SelectorPiso}
        pisos=${pisos}
        pisoActivo=${pisoActivo}
        pisoDestino=${lugarSeleccionado?.pisoNumero ?? null}
        onCambioPiso=${handleCambioPiso}
      />

      <${BottomSheet}
        abierto=${estadoSheet === 'ficha' || estadoSheet === 'ruta'}
        snapInicial=${estadoSheet === 'ruta' ? 'expandido' : 'medio'}
        etiqueta=${estadoSheet === 'ruta' ? 'Cómo llegar' : 'Detalle del lugar'}
        onDismiss=${estadoSheet === 'ruta' ? handleCerrarRuta : handleCerrarFicha}
      >
        ${estadoSheet === 'ficha' && lugarSeleccionado && html`
          <${DestinationCard}
            lugar=${lugarSeleccionado}
            onComoLlegar=${handleComoLlegar}
            onVolver=${handleCerrarFicha}
            esFavorito=${favoritos.has(lugarSeleccionado.id)}
            onToggleFavorito=${handleToggleFavorito}
            esParada=${esParada(lugarSeleccionado.id)}
            onToggleParada=${handleToggleParada}
          />
        `}
        ${estadoSheet === 'ruta' && lugarSeleccionado && html`
          <${RutaPanel}
            origen=${rutaOrigen}
            destino=${lugarSeleccionado}
            ruta=${ruta}
            segmentoIdx=${segmentoRutaIdx}
            segmento=${segmentoRuta}
            pisoActivo=${pisoActivo}
            fuse=${fuse}
            todosLugares=${todosLugares}
            onCambiarOrigen=${handleCambiarOrigen}
            onCerrar=${handleCerrarRuta}
            onVerPisoSiguiente=${handleVerPisoSiguiente}
            onIrASegmento=${handleIrASegmento}
            modoAccesible=${modoAccesible}
            onModoAccesible=${handleModoAccesible}
          />
        `}
      <//>


      ${vistaEditor && editorPiso !== null && html`
        <div class="legacy-overlay">
          <${EditorCampus}
            ...${resolverPisoEditor(pisos, editorPiso)}
            tabInicial=${tabDesdeVista(vistaEditor)}
            todosLugares=${todosLugares}
            grafoInicial=${grafoData}
            pisos=${pisos}
            onSalir=${handleSalirEditor}
            onCambioPiso=${handleCambioPisoEditor}
          />
        </div>
      `}
    </div>
  `;
}
