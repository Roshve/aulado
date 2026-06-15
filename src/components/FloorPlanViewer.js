/**
 * FloorPlanViewer.js — visor de plano interior con zoom/pan y selector de pisos.
 *
 * Zoom/pan implementado con Pointer Events (sin deps):
 *   - Rueda del mouse → zoom
 *   - Pellizco de dos dedos (pinch) → zoom
 *   - Doble-tap / doble-click → zoom 2× en el punto tocado
 *   - Arrastre → pan
 *   - Botón reset → vuelve a 1× centrado
 *
 * Selector de pisos: cambia el plano visualizado; el marcador solo
 * aparece en el piso real del lugar.
 *
 * Props:
 *   lugar    {Object}   lugar enriquecido (ver lib/campus.js)
 *   onCerrar {Function} callback para volver a la ficha
 */
import { html } from 'htm/preact';
import { useState, useRef, useCallback, useEffect } from 'preact/hooks';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

export function FloorPlanViewer({ lugar, onCerrar }) {
  const { nombre, coord, pisoNumero, edificioPisos = [] } = lugar;

  // Piso actualmente visualizado (puede diferir del piso del lugar)
  const [pisoActivo, setPisoActivo] = useState(() => {
    return edificioPisos.find((p) => p.numero === pisoNumero) ?? edificioPisos[0];
  });

  const planoPiso = pisoActivo?.plano ?? lugar.planoPiso;
  const marcadorVisible = pisoActivo?.numero === pisoNumero;

  // Estado de transformación
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const wrapRef = useRef(null);

  // Para gestos táctiles de pellizco
  const touchState = useRef({ dist: null, midX: 0, midY: 0 });
  // Para arrastre
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  // Para doble-tap
  const lastTap = useRef(0);

  function reset() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  /** Aplica zoom centrado en el punto (cx, cy) relativo al wrap. */
  function zoomAt(cx, cy, factor) {
    setScale((prevScale) => {
      const next = clamp(prevScale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = next / prevScale;
      setOffset((prev) => ({
        x: cx - ratio * (cx - prev.x),
        y: cy - ratio * (cy - prev.y),
      }));
      return next;
    });
  }

  /** Clampea el offset para que la imagen no se pierda de vista. */
  function clampOffset(sc, ox, oy) {
    const wrap = wrapRef.current;
    if (!wrap) return { x: ox, y: oy };
    const { width: ww, height: wh } = wrap.getBoundingClientRect();
    const imgW = ww * sc;
    const imgH = (wh > 0 ? wh : ww) * sc; // fallback si aún no pintó
    const maxX = Math.max(0, (imgW - ww) / 2);
    const maxY = Math.max(0, (imgH - wh) / 2);
    return { x: clamp(ox, -maxX, maxX), y: clamp(oy, -maxY, maxY) };
  }

  // ── Rueda del mouse ──────────────────────────────────────────────────────
  function onWheel(e) {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(cx, cy, factor);
  }

  // ── Pointer (arrastre + doble-tap) ───────────────────────────────────────
  function onPointerDown(e) {
    // Solo procesamos si no es un segundo dedo (pellizco se maneja en touch*)
    if (e.pointerType === 'touch') return;
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    containerRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setOffset(() => {
      const raw = { x: dragState.current.ox + dx, y: dragState.current.oy + dy };
      return clampOffset(scale, raw.x, raw.y);
    });
  }

  function onPointerUp() {
    dragState.current.dragging = false;
  }

  function onDoubleClick(e) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    if (scale > 1.5) { reset(); } else { zoomAt(cx, cy, 2.5); }
  }

  // ── Touch (pellizco + arrastre táctil) ──────────────────────────────────
  function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      touchState.current.dist = getTouchDist(e.touches);
      touchState.current.midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      touchState.current.midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    } else if (e.touches.length === 1) {
      // Iniciar arrastre táctil
      dragState.current = {
        dragging: true,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        ox: offset.x,
        oy: offset.y,
      };
      // Doble-tap
      const now = Date.now();
      if (now - lastTap.current < 300) {
        const wrap = wrapRef.current;
        if (wrap) {
          const rect = wrap.getBoundingClientRect();
          const cx = e.touches[0].clientX - rect.left;
          const cy = e.touches[0].clientY - rect.top;
          if (scale > 1.5) { reset(); } else { zoomAt(cx, cy, 2.5); }
        }
      }
      lastTap.current = now;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const newDist = getTouchDist(e.touches);
      const factor = newDist / touchState.current.dist;
      touchState.current.dist = newDist;
      const wrap = wrapRef.current;
      if (wrap) {
        const rect = wrap.getBoundingClientRect();
        const cx = touchState.current.midX - rect.left;
        const cy = touchState.current.midY - rect.top;
        zoomAt(cx, cy, factor);
      }
    } else if (e.touches.length === 1 && dragState.current.dragging) {
      const dx = e.touches[0].clientX - dragState.current.startX;
      const dy = e.touches[0].clientY - dragState.current.startY;
      setOffset(() => {
        const raw = { x: dragState.current.ox + dx, y: dragState.current.oy + dy };
        return clampOffset(scale, raw.x, raw.y);
      });
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) touchState.current.dist = null;
    if (e.touches.length === 0) dragState.current.dragging = false;
  }

  // Registrar wheel con passive:false (necesario para preventDefault)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scale, offset]);

  const transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;

  const markerStyle = {
    position: 'absolute',
    left: `${coord.x}%`,
    top: `${coord.y}%`,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  };

  function handlePisoClick(piso) {
    setPisoActivo(piso);
    reset();
  }

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
        <button
          class="btn-reset-zoom"
          onClick=${reset}
          type="button"
          aria-label="Restablecer zoom"
          title="Restablecer zoom"
        >⊡</button>
      </div>

      <!-- Selector de pisos -->
      ${edificioPisos.length > 1 && html`
        <div class="piso-tabs" role="tablist" aria-label="Seleccionar piso">
          ${edificioPisos.map((p) => html`
            <button
              key=${p.numero}
              class=${`piso-tab${pisoActivo?.numero === p.numero ? ' piso-tab--activo' : ''}${p.numero === pisoNumero ? ' piso-tab--destino' : ''}`}
              role="tab"
              aria-selected=${pisoActivo?.numero === p.numero}
              type="button"
              onClick=${() => handlePisoClick(p)}
            >
              ${p.etiqueta}
              ${p.numero === pisoNumero ? html`<span class="piso-tab-dot" title="Tu destino está aquí" aria-label="Tu destino está aquí">●</span>` : ''}
            </button>
          `)}
        </div>
      `}

      <div
        class="floorplan-wrap"
        ref=${wrapRef}
        onDblClick=${onDoubleClick}
        onPointerDown=${onPointerDown}
        onPointerMove=${onPointerMove}
        onPointerUp=${onPointerUp}
        onTouchStart=${onTouchStart}
        onTouchMove=${onTouchMove}
        onTouchEnd=${onTouchEnd}
        style="touch-action: none; cursor: ${scale > 1 ? 'grab' : 'zoom-in'};"
      >
        <div
          class="floorplan-container"
          ref=${containerRef}
          style=${{ transform, transformOrigin: '0 0', willChange: 'transform', transition: dragState.current?.dragging ? 'none' : 'transform 0.1s ease-out' }}
        >
          <img
            src=${planoPiso}
            alt=${`Plano ${pisoActivo?.etiqueta ?? ''} — ${nombre}`}
            class="floorplan-img"
            draggable="false"
          />

          ${marcadorVisible && html`
            <div
              style=${markerStyle}
              class="marker"
              role="img"
              aria-label=${`Ubicación: ${nombre}`}
            >
              <div class="marker-pulse"></div>
              <div class="marker-dot"></div>
            </div>
          `}

          ${!marcadorVisible && html`
            <div class="marker-otro-piso" aria-live="polite">
              📌 ${nombre} está en <strong>${lugar.pisoEtiqueta}</strong>
            </div>
          `}
        </div>
      </div>

      <p class="floorplan-hint">
        ${marcadorVisible
          ? html`📌 El punto indica la ubicación de <strong>${nombre}</strong> en este piso.`
          : html`⬆️ Seleccioná <strong>${lugar.pisoEtiqueta}</strong> para ver el marcador.`
        }
      </p>
    </div>
  `;
}
