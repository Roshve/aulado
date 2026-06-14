/**
 * SearchBar.js — input de búsqueda + lista de resultados.
 *
 * Props:
 *   query       {string}   valor actual del input
 *   onQuery     {Function} callback(nuevoQuery)
 *   resultados  {Array}    lista de lugares enriquecidos
 *   onSeleccion {Function} callback(lugar)
 */
import { html } from 'htm/preact';
import { useRef } from 'preact/hooks';
import { getBreadcrumb, getIconoTipo } from '../lib/campus.js';

export function SearchBar({ query, onQuery, resultados, onSeleccion }) {
  const inputRef = useRef(null);

  function handleInput(e) {
    onQuery(e.target.value);
  }

  function handleClear() {
    onQuery('');
    inputRef.current?.focus();
  }

  function handleKey(e, lugar) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSeleccion(lugar);
    }
  }

  const mostrarResultados = resultados.length > 0;

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

      ${mostrarResultados && html`
        <ul class="result-list" role="listbox" aria-label="Resultados de búsqueda">
          ${resultados.map((lugar) => html`
            <li
              key=${lugar.id}
              class="result-item"
              role="option"
              tabIndex="0"
              onClick=${() => onSeleccion(lugar)}
              onKeyDown=${(e) => handleKey(e, lugar)}
            >
              <span class="result-icono" aria-hidden="true">${getIconoTipo(lugar.tipo)}</span>
              <span class="result-info">
                <span class="result-nombre">${lugar.nombre}</span>
                <span class="result-breadcrumb">${getBreadcrumb(lugar)}</span>
              </span>
              <span class="result-chevron" aria-hidden="true">›</span>
            </li>
          `)}
        </ul>
      `}

      ${!mostrarResultados && query.trim() && html`
        <div class="search-empty">
          No encontré "${query}" en el campus.
          <small>Probá con el número de aula, el nombre de la oficina o "baño".</small>
        </div>
      `}
    </div>
  `;
}
