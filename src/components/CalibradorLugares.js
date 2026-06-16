/**
 * CalibradorLugares.js — DEPRECATED: usar EditorCampus (#/editar/:piso) tab Lugares.
 *
 * Herramienta dev para recalibrar coord de lugares por drag-and-drop.
 *
 * Acceso: #/calibrar/-1   (subsuelo)
 *         #/calibrar/0    (planta baja)
 *         #/calibrar/1    (1er piso)
 *         #/calibrar/2    (2do piso)
 *
 * Flujo:
 *   • Drag en un pin → reposiciona coord del lugar
 *   • Click en pin → selecciona
 *   • "Copiar JSON" → exporta array lugares del piso al portapapeles
 *
 * Props:
 *   pisoNumero   {number}
 *   todosLugares {Array}
 *   onSalir      {Function}
 */
import { html } from 'htm/preact';
import { useState, useRef } from 'preact/hooks';
import { usePanZoom } from '../lib/usePanZoom.js';
import { resolveAsset } from '../lib/campus.js';
import { screenToPercent, serializarLugaresCampus, posPct } from '../lib/planoCoords.js';

const PLANOS = {
  '-1': '/planos/subsuelo.png',
   0:   '/planos/planta-baja.png',
   1:   '/planos/primer-piso.png',
   2:   '/planos/segundo-piso.png',
};

const ETIQUETA = {
  '-1': 'Subsuelo',
   0:   'Planta Baja',
   1:   '1er Piso',
   2:   '2do Piso',
};

function clonarLugaresPiso(todosLugares, pisoNumero) {
  return todosLugares
    .filter((l) => l.pisoNumero === pisoNumero)
    .map((l) => ({
      ...l,
      coord: { ...l.coord },
      ...(l.puerta ? { puerta: { ...l.puerta } } : {}),
    }));
}

export function CalibradorLugares({ pisoNumero, todosLugares, onSalir }) {
  const pisoStr = String(pisoNumero);
  const plano = resolveAsset(PLANOS[pisoNumero] ?? '');

  const [lugares, setLugares] = useState(() => clonarLugaresPiso(todosLugares, pisoNumero));
  const [selId, setSelId] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [cursorPct, setCursorPct] = useState(null);

  const dragRef = useRef(null);
  const imgRef = useRef(null);
  const wrapRef = useRef(null);
  const containerRef = useRef(null);

  const { scale, offset, transform, reset, handlers } =
    usePanZoom({ wrapRef, containerRef });

  function toPercent(clientX, clientY) {
    return screenToPercent(clientX, clientY, {
      wrapEl: wrapRef.current,
      imgEl: imgRef.current,
      scale,
      offset,
    });
  }

  function handleMouseMove(e) {
    if (dragRef.current?.moved) return;
    setCursorPct(toPercent(e.clientX, e.clientY));
  }

  function handleMouseLeave() {
    setCursorPct(null);
  }

  function handlePlanoClick() {
    setSelId(null);
  }

  function handlePinPointerDown(e, id) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const lugar = lugares.find((l) => l.id === id);
    if (!lugar) return;
    dragRef.current = {
      id,
      clientX: e.clientX,
      clientY: e.clientY,
      moved: false,
    };
  }

  function handlePinPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const dist = Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY);
    if (dist > 5) drag.moved = true;
    if (!drag.moved) return;
    const pct = toPercent(e.clientX, e.clientY);
    if (!pct) return;
    setLugares((prev) => prev.map((l) =>
      l.id === drag.id ? { ...l, coord: { x: pct.x, y: pct.y } } : l,
    ));
  }

  function handlePinPointerUp(e, id) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) return;
    setSelId((prev) => (prev === id ? null : id));
  }

  function handleCopiar() {
    const data = serializarLugaresCampus(lugares);
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
    console.log(`[CalibradorLugares] pisos[${pisoStr}].lugares:`, JSON.stringify(data, null, 2));
  }

  const selLugar = selId ? lugares.find((l) => l.id === selId) : null;

  return html`
    <div class="floorplan-view cal-view">
      <div class="floorplan-topbar">
        <button class="btn-back" onClick=${onSalir} type="button">← Salir</button>
        <span class="floorplan-title">
          📍 Calibrar · ${ETIQUETA[pisoNumero] ?? pisoStr}
        </span>
        <button class="btn-reset-zoom" onClick=${reset} type="button" title="Reset zoom">⊡</button>
      </div>

      <div class="ge-toolbar">
        <span class="ge-stat">${lugares.length} lugares</span>

        <span class="ge-cursor-coord">
          ${cursorPct ? `${cursorPct.x.toFixed(1)}, ${cursorPct.y.toFixed(1)}` : '—, —'}
        </span>

        ${selLugar ? html`
          <span class="ge-stat">
            <code>${selLugar.id}</code>
            (${selLugar.coord.x.toFixed(1)}, ${selLugar.coord.y.toFixed(1)})
          </span>
        ` : null}

        <button
          class="ge-tool-btn"
          type="button"
          onClick=${handleCopiar}
          title="Copiar array lugares al portapapeles"
        >${copiado ? '✓ Copiado' : '📋 Copiar JSON'}</button>
      </div>

      <p class="floorplan-hint ge-hint">
        <strong>Calibrar:</strong>
        Arrastrá cada pin hasta el centro del lugar · Click para seleccionar
        · Pegá el JSON en <code>campus.json</code> → <code>edificios[0].pisos[${pisoStr}].lugares</code>
      </p>

      <div
        class="floorplan-wrap"
        ref=${wrapRef}
        ...${handlers}
        onClick=${handlePlanoClick}
        onMouseMove=${handleMouseMove}
        onMouseLeave=${handleMouseLeave}
        style=${{ touchAction: 'none' }}
      >
        <div
          class="floorplan-container"
          ref=${containerRef}
          style=${{ transform, transformOrigin: '0 0', willChange: 'transform', transition: 'transform 0.1s ease-out' }}
        >
          <img
            ref=${imgRef}
            src=${plano}
            alt=${`Plano ${ETIQUETA[pisoNumero]}`}
            class="floorplan-img"
            draggable="false"
          />

          ${lugares.map((l) => html`
            <div
              key=${l.id}
              class=${`cal-pin${l.id === selId ? ' cal-pin--sel' : ''}`}
              style=${posPct(l.coord)}
              onPointerDown=${(e) => handlePinPointerDown(e, l.id)}
              onPointerMove=${handlePinPointerMove}
              onPointerUp=${(e) => handlePinPointerUp(e, l.id)}
              title=${`${l.id} (${l.coord.x}, ${l.coord.y})`}
              role="button"
              tabindex="0"
            >
              <div class="cal-pin-dot"></div>
              <span class="cal-pin-label">${l.id}</span>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}
