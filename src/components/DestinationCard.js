/**
 * DestinationCard.js — ficha del destino seleccionado.
 *
 * Muestra: nombre, ubicación ("Edificio B — Piso 2"), tipo e íconos.
 * Botones:
 *   - "Ver plano"    → activo (Fase 2)
 *   - "Cómo llegar" → stub deshabilitado (Fase 3)
 *   - "Favorito"    → stub deshabilitado (Fase 4)
 *
 * Props:
 *   lugar     {Object}   lugar enriquecido (ver lib/campus.js)
 *   onVerPlano {Function} callback para abrir el FloorPlanViewer
 *   onVolver   {Function} callback para volver al buscador
 */
import { html } from 'htm/preact';
import { getIconoTipo } from '../lib/campus.js';

export function DestinationCard({ lugar, onVerPlano, onVolver }) {
  const icono = getIconoTipo(lugar.tipo);

  return html`
    <div class="destination-card">
      <button
        class="btn-back"
        onClick=${onVolver}
        type="button"
        aria-label="Volver al buscador"
      >← Buscador</button>

      <div class="card-header">
        <span class="card-icono" aria-hidden="true">${icono}</span>
        <div>
          <h1 class="card-nombre">${lugar.nombre}</h1>
          <p class="card-ubicacion">
            ${lugar.edificioNombre} — ${lugar.pisoEtiqueta}
          </p>
        </div>
      </div>

      <dl class="card-meta">
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
          <dd>${lugar.pisoEtiqueta}</dd>
        </div>
        ${lugar.edificioApodos?.length && html`
          <div class="card-meta-row">
            <dt>También conocido como</dt>
            <dd>${lugar.edificioApodos.join(', ')}</dd>
          </div>
        `}
      </dl>

      <div class="card-actions">
        <button
          class="btn-primary"
          onClick=${onVerPlano}
          type="button"
        >
          🗺️ Ver plano del piso
        </button>

        <!-- Fase 3: habilitar cuando se implemente GPS -->
        <button
          class="btn-secondary"
          type="button"
          disabled
          title="Disponible próximamente"
        >
          📍 Cómo llegar al edificio
        </button>

        <!-- Fase 4: habilitar cuando se implemente favoritos -->
        <button
          class="btn-secondary"
          type="button"
          disabled
          title="Disponible próximamente"
        >
          ☆ Guardar en favoritos
        </button>
      </div>
    </div>
  `;
}
