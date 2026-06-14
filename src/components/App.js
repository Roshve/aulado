/**
 * App.js — raíz de la aplicación. Gestiona estado global y el "ruteo" de vistas.
 *
 * Vistas:
 *   'buscar'   → SearchBar + lista de resultados (pantalla inicial)
 *   'ficha'    → DestinationCard del lugar seleccionado
 *   'plano'    → FloorPlanViewer del piso del lugar
 *
 * Estado:
 *   query       {string}         texto actual del buscador
 *   seleccionado {Object|null}   lugar enriquecido actualmente elegido
 *   vista       {'buscar'|'ficha'|'plano'}
 */
import { html } from 'htm/preact';
import { useState, useMemo } from 'preact/hooks';

import campusData from '../data/campus.json';
import { aplanarLugares } from '../lib/campus.js';
import { crearBuscador, buscar } from '../lib/search.js';
import { SearchBar } from './SearchBar.js';
import { DestinationCard } from './DestinationCard.js';
import { FloorPlanViewer } from './FloorPlanViewer.js';

// Preparar datos una sola vez (fuera del componente: no recalcular en cada render).
const todosLugares = aplanarLugares(campusData);
const fuse = crearBuscador(todosLugares);

export function App() {
  const [query, setQuery] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [vista, setVista] = useState('buscar');

  // Resultados de búsqueda reactivos: solo se recalculan cuando cambia query.
  const resultados = useMemo(
    () => buscar(fuse, query, todosLugares),
    [query],
  );

  function handleSeleccion(lugar) {
    setSeleccionado(lugar);
    setVista('ficha');
  }

  function handleVolver() {
    setVista('buscar');
    // Mantenemos query y seleccionado para que volver sea instantáneo.
  }

  function handleVerPlano() {
    setVista('plano');
  }

  function handleCerrarPlano() {
    setVista('ficha');
  }

  return html`
    <div class="app">
      <header class="app-header">
        <h1 class="app-title">
          <span aria-hidden="true">🎓</span> Aulado
        </h1>
        <p class="app-subtitle">Campus Central</p>
      </header>

      <main class="app-main">
        ${vista === 'buscar' && html`
          <${SearchBar}
            query=${query}
            onQuery=${setQuery}
            resultados=${resultados}
            onSeleccion=${handleSeleccion}
          />
        `}

        ${vista === 'ficha' && seleccionado && html`
          <${DestinationCard}
            lugar=${seleccionado}
            onVerPlano=${handleVerPlano}
            onVolver=${handleVolver}
          />
        `}

        ${vista === 'plano' && seleccionado && html`
          <${FloorPlanViewer}
            planoPiso=${seleccionado.planoPiso}
            coord=${seleccionado.coord}
            nombre=${seleccionado.nombre}
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
