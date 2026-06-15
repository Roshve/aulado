/**
 * App.js — raíz de la aplicación. Gestiona estado global y el "ruteo" de vistas.
 *
 * Vistas:
 *   'buscar'   → SearchBar + lista de resultados (pantalla inicial)
 *   'ficha'    → DestinationCard del lugar seleccionado
 *   'plano'    → FloorPlanViewer del piso del lugar
 *
 * Estado:
 *   query        {string}              texto actual del buscador
 *   tipoFiltro   {string|null}         filtro activo por tipo de lugar
 *   seleccionado {Object|null}         lugar enriquecido actualmente elegido
 *   vista        {'buscar'|'ficha'|'plano'}
 *   favoritos    {Set<string>}         IDs marcados como favorito (mirror de localStorage)
 */
import { html } from 'htm/preact';
import { useState, useMemo, useEffect } from 'preact/hooks';

import campusData from '../data/campus.json';
import { aplanarLugares, getLugarById } from '../lib/campus.js';
import { crearBuscador, buscar } from '../lib/search.js';
import { getFavoritos, toggleFavorito } from '../lib/favorites.js';
import { agregarReciente, getRecientes } from '../lib/recents.js';
import { SearchBar } from './SearchBar.js';
import { DestinationCard } from './DestinationCard.js';
import { FloorPlanViewer } from './FloorPlanViewer.js';

// Preparar datos una sola vez (fuera del componente: no recalcular en cada render).
const todosLugares = aplanarLugares(campusData);
const fuse = crearBuscador(todosLugares);

/** Lee el hash actual y retorna { vista, id } o null si no hay hash válido. */
function parseHash() {
  const hash = location.hash; // ej. "#/lugar/s-01" o "#/plano/s-01"
  const m = hash.match(/^#\/(lugar|plano)\/(.+)$/);
  if (!m) return null;
  return { vista: m[1] === 'plano' ? 'plano' : 'ficha', id: m[2] };
}

export function App() {
  const [query, setQuery] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [vista, setVista] = useState('buscar');
  const [favoritos, setFavoritos] = useState(() => getFavoritos());
  const [recientes, setRecientes] = useState(() => getRecientes(todosLugares));

  // Hidratar desde hash al montar
  useEffect(() => {
    const parsed = parseHash();
    if (parsed) {
      const lugar = getLugarById(todosLugares, parsed.id);
      if (lugar) {
        setSeleccionado(lugar);
        setVista(parsed.vista);
      }
    }

    // Botón atrás / adelante del navegador
    const onPop = () => {
      const p = parseHash();
      if (!p) {
        setVista('buscar');
        setSeleccionado(null);
      } else {
        const lugar = getLugarById(todosLugares, p.id);
        if (lugar) { setSeleccionado(lugar); setVista(p.vista); }
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** Empuja un nuevo estado al historial y actualiza el hash. */
  function pushHash(vistaDestino, lugar) {
    if (!lugar) {
      history.pushState(null, '', location.pathname);
      return;
    }
    const segment = vistaDestino === 'plano' ? 'plano' : 'lugar';
    history.pushState(null, '', `${location.pathname}#/${segment}/${lugar.id}`);
  }

  // Resultados de búsqueda reactivos
  const resultadosBrutos = useMemo(
    () => buscar(fuse, query, todosLugares),
    [query],
  );
  const resultados = useMemo(
    () => (tipoFiltro ? resultadosBrutos.filter((l) => l.tipo === tipoFiltro) : resultadosBrutos),
    [resultadosBrutos, tipoFiltro],
  );

  function handleSeleccion(lugar) {
    setSeleccionado(lugar);
    setVista('ficha');
    pushHash('ficha', lugar);
    // Registrar en recientes
    const nuevos = agregarReciente(lugar.id, todosLugares);
    setRecientes(nuevos);
  }

  function handleVolver() {
    setVista('buscar');
    history.pushState(null, '', location.pathname);
  }

  function handleVerPlano() {
    setVista('plano');
    pushHash('plano', seleccionado);
  }

  function handleCerrarPlano() {
    setVista('ficha');
    pushHash('ficha', seleccionado);
  }

  function handleToggleFavorito(id) {
    toggleFavorito(id);
    setFavoritos(getFavoritos());
  }

  return html`
    <div class="app">
      <header class="app-header">
        <h1 class="app-title">
          <span aria-hidden="true">🎓</span> Aulado
        </h1>
        <p class="app-subtitle">Campus Central</p>
      </header>

      <main class="app-main" aria-live="polite" aria-atomic="false">
        ${vista === 'buscar' && html`
          <${SearchBar}
            query=${query}
            onQuery=${setQuery}
            tipoFiltro=${tipoFiltro}
            onTipoFiltro=${setTipoFiltro}
            resultados=${resultados}
            todosLugares=${todosLugares}
            onSeleccion=${handleSeleccion}
            favoritos=${favoritos}
            recientes=${recientes}
          />
        `}

        ${vista === 'ficha' && seleccionado && html`
          <${DestinationCard}
            lugar=${seleccionado}
            onVerPlano=${handleVerPlano}
            onVolver=${handleVolver}
            esFavorito=${favoritos.has(seleccionado.id)}
            onToggleFavorito=${handleToggleFavorito}
          />
        `}

        ${vista === 'plano' && seleccionado && html`
          <${FloorPlanViewer}
            lugar=${seleccionado}
            onCerrar=${handleCerrarPlano}
          />
        `}
      </main>

      <footer class="app-footer">
        <p>
          Datos del campus · Código abierto bajo <a href="/LICENSE" target="_blank">MIT</a>
        </p>
      </footer>
    </div>
  `;
}
