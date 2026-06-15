/**
 * DestinationCard.js — ficha del destino seleccionado.
 *
 * Props:
 *   lugar            {Object}   lugar enriquecido (ver lib/campus.js)
 *   onVerPlano       {Function} callback para abrir el FloorPlanViewer
 *   onVolver         {Function} callback para volver al buscador
 *   esFavorito       {boolean}  true si el lugar está guardado como favorito
 *   onToggleFavorito {Function} callback(id) para marcar/desmarcar
 */
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { getIconoTipo } from '../lib/campus.js';
import { linkDirecciones } from '../lib/geo.js';

export function DestinationCard({ lugar, onVerPlano, onVolver, esFavorito, onToggleFavorito }) {
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
            ${lugar.edificioNombre} — <span class="mono">${lugar.pisoEtiqueta}</span>
          </p>
          <span class="badge badge--tipo badge--${lugar.tipo}">${lugar.tipo}</span>
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
          <dd class="mono">${lugar.pisoEtiqueta}</dd>
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

        <a
          class="btn-secondary btn-link"
          href=${linkDirecciones(lugar.edificioEntrada)}
          target="_blank"
          rel="noopener noreferrer"
        >
          📍 Cómo llegar al edificio
        </a>

        <button
          class=${`btn-secondary btn-favorito${esFavorito ? ' btn-favorito--activo' : ''}`}
          type="button"
          onClick=${() => onToggleFavorito(lugar.id)}
          aria-pressed=${esFavorito}
          aria-label=${esFavorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        >
          ${esFavorito ? '★ Guardado en favoritos' : '☆ Guardar en favoritos'}
        </button>

        <button
          class="btn-secondary"
          type="button"
          onClick=${handleCompartir}
        >
          ${copiado ? '✓ Link copiado' : '🔗 Compartir'}
        </button>
      </div>
    </div>
  `;
}
