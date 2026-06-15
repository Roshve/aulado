/**
 * FloorPlanViewer.js — visor de plano interior con marcador posicional.
 *
 * El marcador se posiciona con left/top en % sobre la imagen del plano,
 * usando las coordenadas {x, y} del JSON (0–100 sobre cada eje).
 * Responsive sin recálculo: todo es relativo a las dimensiones de la imagen.
 *
 * Props:
 *   planoPiso  {string}  ruta a la imagen del plano (ej. "/planos/edif-b-p2.svg")
 *   coord      {Object}  { x: number, y: number } en porcentaje (0–100)
 *   nombre     {string}  nombre del destino (para el tooltip y aria-label)
 *   onCerrar   {Function} callback para volver a la ficha
 */
import { html } from 'htm/preact';

export function FloorPlanViewer({ planoPiso, coord, nombre, onCerrar }) {
  const markerStyle = {
    position: 'absolute',
    left: `${coord.x}%`,
    top: `${coord.y}%`,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  };

  return html`
    <div class="floorplan-view">
      <div class="floorplan-topbar">
        <button
          class="btn-back"
          onClick=${onCerrar}
          type="button"
          aria-label="Volver a la ficha"
        >← Volver</button>
        <span class="floorplan-title">${nombre}</span>
      </div>

      <div class="floorplan-wrap">
        <div class="floorplan-container">
          <img
            src=${planoPiso}
            alt=${`Plano del piso — ${nombre}`}
            class="floorplan-img"
            draggable="false"
          />

          <!-- Marcador del destino -->
          <div
            style=${markerStyle}
            class="marker"
            role="img"
            aria-label=${`Ubicación: ${nombre}`}
          >
            <div class="marker-pulse"></div>
            <div class="marker-dot"></div>
          </div>
        </div>
      </div>

      <p class="floorplan-hint">
        📌 El punto indica la ubicación de <strong>${nombre}</strong> en este piso.
      </p>
    </div>
  `;
}
