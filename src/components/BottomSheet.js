/**
 * BottomSheet.js — panel deslizante anclado al fondo del viewport.
 *
 * Props:
 *   abierto      {boolean}                  — si false, el sheet no renderiza
 *   snapInicial  {'colapsado'|'medio'|'expandido'}  — snap al abrir (default: 'medio')
 *   etiqueta     {string}                   — aria-label del diálogo
 *   onDismiss    {Function}                 — callback al cerrar (swipe-down / Esc)
 *   children     {any}                      — contenido del sheet
 */
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';

const SNAPS = ['colapsado', 'medio', 'expandido'];

export function BottomSheet({ abierto, snapInicial = 'medio', etiqueta, onDismiss, children }) {
  const [snap, setSnap] = useState(snapInicial);
  const sheetRef = useRef(null);

  // Resetear snap al abrir
  useEffect(() => {
    if (abierto) {
      setSnap(snapInicial);
      // Mover foco al contenedor al abrir
      requestAnimationFrame(() => sheetRef.current?.focus());
    }
  }, [abierto, snapInicial]);

  // Esc → dismiss
  useEffect(() => {
    if (!abierto) return;
    function onKey(e) {
      if (e.key === 'Escape') onDismiss();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, onDismiss]);

  // ── Drag con Pointer Events ───────────────────────────────────────
  const dragState = useRef(null);

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, moved: false };
  }

  function handlePointerMove(e) {
    if (!dragState.current) return;
    dragState.current.moved = true;
    dragState.current.lastY = e.clientY;
  }

  function handlePointerUp(e) {
    if (!dragState.current) return;
    const delta = (dragState.current.lastY ?? e.clientY) - dragState.current.startY;
    dragState.current = null;

    const UMBRAL_DISMISS = 120;
    const UMBRAL_SNAP = 60;

    if (delta > UMBRAL_DISMISS) {
      onDismiss();
      return;
    }

    const idx = SNAPS.indexOf(snap);
    if (delta > UMBRAL_SNAP && idx > 0) {
      setSnap(SNAPS[idx - 1]);
    } else if (delta < -UMBRAL_SNAP && idx < SNAPS.length - 1) {
      setSnap(SNAPS[idx + 1]);
    }
  }

  if (!abierto) return null;

  return html`
    <div
      ref=${sheetRef}
      class=${'bottom-sheet bottom-sheet--' + snap}
      role="dialog"
      aria-modal="false"
      aria-label=${etiqueta}
      tabIndex="-1"
    >
      <div
        class="sheet-handle"
        onPointerDown=${handlePointerDown}
        onPointerMove=${handlePointerMove}
        onPointerUp=${handlePointerUp}
        aria-hidden="true"
      >
        <div class="sheet-handle__bar"></div>
      </div>
      <div class="bottom-sheet__content">
        ${children}
      </div>
    </div>
  `;
}
