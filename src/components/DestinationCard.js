/**
 * DestinationCard.js — ficha del destino, estilo Google Maps.
 *
 * Props:
 *   lugar            {Object}
 *   onComoLlegar     {Function}
 *   onVolver         {Function}
 *   esFavorito       {boolean}
 *   onToggleFavorito {Function}
 *   esParada         {boolean}
 *   onToggleParada   {Function}
 */
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { getIconoTipo } from '../lib/campus.js';

export function DestinationCard({ lugar, onComoLlegar, onVolver, esFavorito, onToggleFavorito, esParada, onToggleParada }) {
  const icono = getIconoTipo(lugar.tipo);
  const [copiado, setCopiado] = useState(false);

  function handleCompartir() {
    const url = location.href;
    if (navigator.share) {
      navigator.share({ title: lugar.nombre, text: `${lugar.nombre} — ${lugar.pisoEtiqueta}`, url });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      });
    }
  }

  return html`
    <div class="destination-card">

      <!-- Header compacto -->
      <div class="card-place-header">
        <button
          class="card-back-btn"
          onClick=${onVolver}
          type="button"
          aria-label="Volver al buscador"
        >✕</button>
        <span class="card-place-icon" aria-hidden="true">${icono}</span>
        <div class="card-place-info">
          <h1 class="card-place-nombre">${lugar.nombre}</h1>
          <p class="card-place-sub">
            <span class="badge badge--tipo badge--${lugar.tipo}">${lugar.tipo}</span>
            ${' '} ${lugar.edificioNombre} · ${lugar.pisoEtiqueta}
          </p>
        </div>
      </div>

      <!-- Fila de botones icono -->
      <div class="card-action-row">
        <button
          class="card-action-btn card-action-btn--primary"
          type="button"
          onClick=${onComoLlegar}
          aria-label="Cómo llegar"
        >
          <span class="card-action-icon">🧭</span>
          <span class="card-action-label">Cómo llegar</span>
        </button>

        <button
          class=${`card-action-btn${esFavorito ? ' card-action-btn--active' : ''}`}
          type="button"
          onClick=${() => onToggleFavorito(lugar.id)}
          aria-pressed=${esFavorito}
          aria-label=${esFavorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        >
          <span class="card-action-icon">${esFavorito ? '★' : '☆'}</span>
          <span class="card-action-label">${esFavorito ? 'Guardado' : 'Guardar'}</span>
        </button>

        <button
          class=${`card-action-btn${esParada ? ' card-action-btn--active-green' : ''}`}
          type="button"
          onClick=${() => onToggleParada(lugar.id)}
          aria-pressed=${esParada}
          aria-label=${esParada ? 'Quitar de paradas' : 'Agregar a paradas'}
        >
          <span class="card-action-icon">${esParada ? '✓' : '📍'}</span>
          <span class="card-action-label">${esParada ? 'En paradas' : 'Parada'}</span>
        </button>

        <button
          class="card-action-btn"
          type="button"
          onClick=${handleCompartir}
          aria-label="Compartir"
        >
          <span class="card-action-icon">${copiado ? '✓' : '🔗'}</span>
          <span class="card-action-label">${copiado ? 'Copiado' : 'Compartir'}</span>
        </button>
      </div>

      <!-- Meta info -->
      <dl class="card-meta card-meta-compact">
        <div class="card-meta-row">
          <dt>Tipo</dt>
          <dd>${lugar.tipo.charAt(0).toUpperCase() + lugar.tipo.slice(1)}</dd>
        </div>
        <div class="card-meta-row">
          <dt>Edificio</dt>
          <dd>${lugar.edificioNombre}</dd>
        </div>
        <div class="card-meta-row">
          <dt>Piso</dt>
          <dd class="mono">${lugar.pisoEtiqueta}</dd>
        </div>
        ${lugar.edificioApodos?.length && html`
          <div class="card-meta-row">
            <dt>También conocido como</dt>
            <dd>${lugar.edificioApodos.join(', ')}</dd>
          </div>
        `}
      </dl>
    </div>
  `;
}
