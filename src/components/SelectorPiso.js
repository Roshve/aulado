/**
 * SelectorPiso.js — control de piso estilo GMaps indoor (Fase 2).
 *
 * Lista vertical de botones siempre visible sobre el mapa.
 * Pisos superiores arriba, subsuelo abajo (orden invertido respecto a listarPisos).
 *
 * Props:
 *   pisos         {Array<{numero, etiqueta}>}
 *   pisoActivo    {number}
 *   pisoDestino   {number|null}  — piso del lugar seleccionado (indicador opcional)
 *   onCambioPiso  {Function}     — callback(pisoNumero)
 */
import { html } from 'htm/preact';

/**
 * @param {{ pisos: Array<{numero: number, etiqueta: string}>, pisoActivo: number, pisoDestino?: number|null, onCambioPiso: Function }} props
 */
export function SelectorPiso({ pisos, pisoActivo, pisoDestino = null, onCambioPiso }) {
  if (pisos.length <= 1) return null;

  const pisosVisibles = [...pisos].reverse();

  return html`
    <nav class="selector-piso" aria-label="Seleccionar piso">
      <div class="selector-piso__lista" role="tablist">
        ${pisosVisibles.map((p) => html`
          <button
            key=${p.numero}
            type="button"
            role="tab"
            class=${`selector-piso__btn${pisoActivo === p.numero ? ' selector-piso__btn--activo' : ''}${pisoDestino === p.numero && pisoDestino !== pisoActivo ? ' selector-piso__btn--destino' : ''}`}
            aria-selected=${pisoActivo === p.numero}
            onClick=${() => onCambioPiso(p.numero)}
          >
            ${p.etiqueta}
            ${pisoDestino === p.numero && pisoDestino !== pisoActivo
              ? html`<span class="selector-piso__dot" aria-label="Destino en este piso">●</span>`
              : ''
            }
          </button>
        `)}
      </div>
    </nav>
  `;
}
