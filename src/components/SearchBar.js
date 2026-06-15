/**
 * SearchBar.js — input de búsqueda + filtros por tipo + lista de resultados.
 *
 * Props:
 *   query         {string}        valor actual del input
 *   onQuery       {Function}      callback(nuevoQuery)
 *   tiposFiltro   {string[]}      tipos activos para filtrar (OR)
 *   onTiposFiltro {Function}      callback(tipos[])
 *   resultados    {Array}         lista de lugares enriquecidos (ya filtrados)
 *   todosLugares  {Array}         lista completa para derivar tipos disponibles
 *   onSeleccion   {Function}      callback(lugar)
 *   favoritos     {Set<string>}   IDs marcados como favorito
 *   recientes     {Array}         lugares vistos recientemente
 */
import { html } from 'htm/preact';
import { useRef, useMemo } from 'preact/hooks';
import { getBreadcrumb, getIconoTipo } from '../lib/campus.js';
import { segmentarResaltado } from '../lib/search.js';

export function SearchBar({
  query, onQuery,
  tiposFiltro, onTiposFiltro,
  resultados, todosLugares,
  onSeleccion,
  favoritos, recientes,
}) {
  const inputRef = useRef(null);

  function handleInput(e) { onQuery(e.target.value); }
  function handleClear() { onQuery(''); inputRef.current?.focus(); }
  function handleKey(e, lugar) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleccion(lugar); }
  }
  function toggleTipo(tipo) {
    onTiposFiltro(
      tiposFiltro.includes(tipo)
        ? tiposFiltro.filter((t) => t !== tipo)
        : [...tiposFiltro, tipo],
    );
  }

  // Tipos únicos disponibles en el campus, para los chips de filtro
  const tiposDisponibles = useMemo(
    () => [...new Set(todosLugares.map((l) => l.tipo))].sort(),
    [todosLugares],
  );

  const queryActiva = query.trim().length > 0;
  const filtrosActivos = tiposFiltro.length > 0;
  const mostrarResultados = resultados.length > 0 && (queryActiva || filtrosActivos);

  // Favoritos y recientes como listas de objetos
  const lugaresFavoritos = useMemo(
    () => todosLugares.filter((l) => favoritos.has(l.id)),
    [todosLugares, favoritos],
  );

  const mostrarSugerencias = !queryActiva && !filtrosActivos;

  const tiposFiltroTexto = tiposFiltro.join(', ');

  return html`
    <div class="search-container">
      <div class="search-input-wrap">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input
          ref=${inputRef}
          class="search-input"
          type="search"
          placeholder="Buscar aula, oficina, baño…"
          value=${query}
          onInput=${handleInput}
          aria-label="Buscar destino en el campus"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
        />
        ${query && html`
          <button
            class="search-clear"
            onClick=${handleClear}
            aria-label="Limpiar búsqueda"
            type="button"
          >✕</button>
        `}
      </div>

      <!-- Chips de filtro por tipo -->
      <div class="filter-chips" role="group" aria-label="Filtrar por tipo">
        ${tiposDisponibles.map((tipo) => html`
          <button
            key=${tipo}
            class=${`filter-chip${tiposFiltro.includes(tipo) ? ' filter-chip--activo' : ''}`}
            type="button"
            onClick=${() => toggleTipo(tipo)}
            aria-pressed=${tiposFiltro.includes(tipo)}
          >
            ${getIconoTipo(tipo)} ${tipo}
          </button>
        `)}
      </div>

      <!-- Resultados de búsqueda activa o filtro -->
      ${mostrarResultados && html`
        <ul class="result-list" role="listbox" aria-label="Resultados de búsqueda">
          ${resultados.map((lugar) => html`
            <${ResultItem}
              key=${lugar.id}
              lugar=${lugar}
              query=${queryActiva ? query : ''}
              onSeleccion=${onSeleccion}
              handleKey=${handleKey}
            />
          `)}
        </ul>
      `}

      <!-- Sin resultados -->
      ${!mostrarResultados && (queryActiva || filtrosActivos) && html`
        <div class="search-empty">
          <span aria-hidden="true" style="font-size: 2rem">🔍</span>
          <strong class="search-empty-title">Sin resultados</strong>
          ${queryActiva
            ? html`<span>No encontré "<span class="mono">${query}</span>"${filtrosActivos ? ` en tipo${tiposFiltro.length > 1 ? 's' : ''} "${tiposFiltroTexto}"` : ''}</span>`
            : html`<span>No hay lugares de tipo <strong>${tiposFiltroTexto}</strong></span>`
          }
          <small>Probá con el número de aula, el nombre de la oficina o "baño".</small>
        </div>
      `}

      <!-- Estado vacío: Favoritos + Recientes -->
      ${mostrarSugerencias && html`
        <div class="sugerencias">
          ${lugaresFavoritos.length > 0 && html`
            <section class="sugerencias-seccion">
              <h2 class="sugerencias-titulo">⭐ Favoritos</h2>
              <ul class="result-list" role="listbox" aria-label="Tus favoritos">
                ${lugaresFavoritos.map((lugar) => html`
                  <${ResultItem} key=${lugar.id} lugar=${lugar} onSeleccion=${onSeleccion} handleKey=${handleKey} />
                `)}
              </ul>
            </section>
          `}

          ${recientes.length > 0 && html`
            <section class="sugerencias-seccion">
              <h2 class="sugerencias-titulo">🕘 Visitados recientemente</h2>
              <ul class="result-list" role="listbox" aria-label="Visitados recientemente">
                ${recientes.map((lugar) => html`
                  <${ResultItem} key=${lugar.id} lugar=${lugar} onSeleccion=${onSeleccion} handleKey=${handleKey} />
                `)}
              </ul>
            </section>
          `}

          ${lugaresFavoritos.length === 0 && recientes.length === 0 && html`
            <div class="search-empty search-empty--inicio">
              <span aria-hidden="true" style="font-size: 2rem">🎓</span>
              <strong class="search-empty-title">Encontrá tu aula</strong>
              <span>Escribí el número de aula, nombre de oficina o tipo de espacio.</span>
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

function HighlightedText({ text, query }) {
  const segmentos = segmentarResaltado(text, query);
  return html`
    <span class="result-nombre">
      ${segmentos.map((seg, i) => (
        seg.highlight
          ? html`<mark key=${i} class="search-highlight">${seg.text}</mark>`
          : seg.text
      ))}
    </span>
  `;
}

function ResultItem({ lugar, query = '', onSeleccion, handleKey }) {
  return html`
    <li
      class="result-item"
      role="option"
      tabIndex="0"
      onClick=${() => onSeleccion(lugar)}
      onKeyDown=${(e) => handleKey(e, lugar)}
    >
      <span class="result-icono" aria-hidden="true">${getIconoTipo(lugar.tipo)}</span>
      <span class="result-info">
        <${HighlightedText} text=${lugar.nombre} query=${query} />
        <span class="result-breadcrumb mono">${getBreadcrumb(lugar)}</span>
      </span>
      <span class="badge badge--tipo badge--${lugar.tipo}" aria-hidden="true">${lugar.tipo}</span>
      <span class="result-chevron" aria-hidden="true">›</span>
    </li>
  `;
}
