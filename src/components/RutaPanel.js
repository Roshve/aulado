/**
 * RutaPanel.js — panel de navegación Desde/Hasta, estilo Google Maps.
 *
 * Props:
 *   origen              {Object}   lugar enriquecido del punto de partida
 *   destino             {Object}   lugar enriquecido del destino
 *   ruta                {Object}   resultado de calcularRuta()
 *   segmentoIdx         {number}   índice del segmento activo
 *   segmento            {Object}   segmento activo de la ruta
 *   pisoActivo          {number}   piso visible en el mapa
 *   fuse                {Object}   instancia Fuse.js
 *   todosLugares        {Array}
 *   onCambiarOrigen     {Function} (id) => void
 *   onCerrar            {Function} volver a la ficha
 *   onVerPisoSiguiente  {Function} avanzar al siguiente segmento
 *   onIrASegmento       {Function} (idx) => void
 *   modoAccesible       {boolean}
 *   onModoAccesible     {Function}
 */
import { html } from 'htm/preact';
import { useState, useMemo, useRef, useEffect } from 'preact/hooks';
import { filtrarLugares } from '../lib/search.js';
import { hintSegmento } from '../lib/mapRuta.js';

export function RutaPanel({
  origen, destino, ruta,
  segmentoIdx = 0, segmento, pisoActivo,
  fuse, todosLugares,
  onCambiarOrigen, onCerrar,
  onVerPisoSiguiente, onIrASegmento,
  modoAccesible, onModoAccesible,
}) {
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [queryOrigen, setQueryOrigen] = useState('');
  const inputRef = useRef(null);

  const resultadosPicker = useMemo(
    () => filtrarLugares(fuse, queryOrigen, todosLugares, []).slice(0, 6),
    [fuse, queryOrigen, todosLugares],
  );

  useEffect(() => {
    if (pickerAbierto) inputRef.current?.focus();
  }, [pickerAbierto]);

  function handleSeleccionarOrigen(lugar) {
    setPickerAbierto(false);
    setQueryOrigen('');
    onCambiarOrigen(lugar.id);
  }

  function handleSwap() {
    if (!origen || !destino) return;
    onCambiarOrigen(destino.id);
  }

  const distanciaM = ruta?.distanciaTotal
    ? Math.round(ruta.distanciaTotal * 0.15)
    : null;

  const hint = segmento ? hintSegmento(segmento, origen, destino) : '';

  return html`
    <div class="ruta-panel">

      <!-- Header -->
      <div class="ruta-panel-header">
        <button class="card-back-btn" onClick=${onCerrar} type="button" aria-label="Volver">←</button>
        <span class="ruta-panel-title">🧭 Cómo llegar</span>
      </div>

      <!-- Inputs Desde / Hasta -->
      <div class="ruta-inputs-block">

        <!-- Desde -->
        <div class="ruta-input-row">
          <span class="ruta-input-dot ruta-input-dot--origen"></span>
          <div
            class=${'ruta-input-field' + (pickerAbierto ? ' ruta-input-field--activo' : '')}
            role="button"
            tabIndex="0"
            onClick=${() => setPickerAbierto((v) => !v)}
            onKeyDown=${(e) => e.key === 'Enter' && setPickerAbierto((v) => !v)}
          >
            <span>
              <span class="ruta-input-nombre">${origen?.nombre ?? 'Mi ubicación'}</span>
              <br/>
              <span class="ruta-input-sub">Donde estoy</span>
            </span>
            <button
              class="ruta-input-clear"
              type="button"
              aria-label="Cambiar origen"
              onClick=${(e) => { e.stopPropagation(); setPickerAbierto(true); }}
            >✎</button>
          </div>
        </div>

        <!-- Conector + Swap -->
        <div class="ruta-connector-wrap">
          <div class="ruta-connector-line"></div>
          <button
            class="ruta-swap-btn"
            type="button"
            aria-label="Intercambiar origen y destino"
            onClick=${handleSwap}
            title="Intercambiar"
          >⇅</button>
        </div>

        <!-- Hasta -->
        <div class="ruta-input-row">
          <span class="ruta-input-dot ruta-input-dot--destino"></span>
          <div class="ruta-input-field">
            <span>
              <span class="ruta-input-nombre">${destino?.nombre ?? '—'}</span>
              <br/>
              <span class="ruta-input-sub">Adonde voy</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Picker de origen inline -->
      ${pickerAbierto && html`
        <div class="ruta-origen-picker">
          <input
            ref=${inputRef}
            class="ruta-origen-input"
            type="search"
            placeholder="Buscar punto de partida…"
            value=${queryOrigen}
            onInput=${(e) => setQueryOrigen(e.target.value)}
            aria-label="Buscar punto de partida"
          />
          <ul class="result-list" role="listbox" style="max-height:200px">
            ${resultadosPicker.map((l) => html`
              <li
                key=${l.id}
                class="result-item"
                role="option"
                tabIndex="0"
                onClick=${() => handleSeleccionarOrigen(l)}
                onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && handleSeleccionarOrigen(l)}
              >
                <span class="result-info">
                  <span class="result-nombre">${l.nombre}</span>
                  <span class="result-breadcrumb mono">${l.pisoEtiqueta}</span>
                </span>
              </li>
            `)}
          </ul>
        </div>
      `}

      <!-- Toggle accesible -->
      <label class="ruta-accesible">
        <input
          type="checkbox"
          checked=${modoAccesible}
          onChange=${(e) => onModoAccesible(e.target.checked)}
        />
        ♿ Modo accesible (evitar escaleras)
      </label>

      <!-- Resultado -->
      <div class="ruta-result">
        ${ruta?.ok
          ? html`
            <div class="ruta-result-ok">
              ✅ Ruta encontrada
            </div>
            ${distanciaM !== null && html`
              <p class="ruta-result-dist">
                ~${distanciaM} m · ${ruta.segmentos.length} tramo${ruta.segmentos.length > 1 ? 's' : ''}
                ${ruta.segmentos.length > 1 ? html` · pasa por ${ruta.segmentos.length - 1} cambio${ruta.segmentos.length > 2 ? 's' : ''} de piso` : ''}
              </p>
            `}

            ${ruta.segmentos.length > 1 && html`
              <div class="piso-tabs ruta-segmento-tabs" role="tablist" aria-label="Segmentos de la ruta">
                ${ruta.segmentos.map((seg, i) => html`
                  <button
                    key=${seg.piso}
                    type="button"
                    role="tab"
                    class=${`piso-tab${i === segmentoIdx ? ' piso-tab--activo' : ''}${seg.piso === pisoActivo ? ' piso-tab--destino' : ''}`}
                    aria-selected=${i === segmentoIdx}
                    onClick=${() => onIrASegmento(i)}
                  >
                    ${seg.etiqueta}
                  </button>
                `)}
              </div>
            `}

            ${hint && html`
              <p class="ruta-segmento-hint" role="status">
                ${segmento?.etiqueta && html`
                  <span class="badge badge--tipo ruta-piso-badge">${segmento.etiqueta}</span>
                `}
                ${hint}
              </p>
            `}

            ${segmento?.transicion && html`
              <div class="ruta-transicion-banner" role="status">
                <span>${segmento.transicion}</span>
                ${segmentoIdx + 1 < ruta.segmentos.length && html`
                  <button
                    class="ruta-transicion-btn"
                    type="button"
                    onClick=${onVerPisoSiguiente}
                  >
                    Ver piso siguiente →
                  </button>
                `}
              </div>
            `}
          `
          : ruta && html`
            <p class="ruta-result-error">
              ❌ No se encontró camino entre estos dos puntos.
            </p>
          `
        }
        ${!ruta && html`
          <p class="ruta-result-dist">Calculando ruta…</p>
        `}
      </div>
    </div>
  `;
}
