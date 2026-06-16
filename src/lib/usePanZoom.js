/**
 * usePanZoom.js — hook de zoom/pan para el editor de grafo (GraphEditor, #/anotar).
 *
 * Único consumidor activo tras la migración a Leaflet en el shell principal.
 *
 * Uso:
 *   const { scale, offset, reset, transform, containerHandlers, wrapHandlers }
 *     = usePanZoom({ wrapRef, containerRef });
 *
 * Los handlers se aplican con spread sobre los elementos correspondientes:
 *   <div ref=${wrapRef}    ...${wrapHandlers}>
 *   <div ref=${containerRef} ...${containerHandlers}>
 */
import { useState, useRef, useCallback, useEffect } from 'preact/hooks';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

export function usePanZoom({ wrapRef, containerRef }) {
  const [scale, setScale]   = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const touchState = useRef({ dist: null, midX: 0, midY: 0 });
  const dragState  = useRef({ dragging: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  const lastTap    = useRef(0);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  /** Clampea el offset para que la imagen no se pierda de vista. */
  function clampOffset(sc, ox, oy) {
    const wrap = wrapRef.current;
    if (!wrap) return { x: ox, y: oy };
    const { width: ww, height: wh } = wrap.getBoundingClientRect();
    const imgW = ww * sc;
    const imgH = (wh > 0 ? wh : ww) * sc;
    const maxX = Math.max(0, (imgW - ww) / 2);
    const maxY = Math.max(0, (imgH - wh) / 2);
    return { x: clamp(ox, -maxX, maxX), y: clamp(oy, -maxY, maxY) };
  }

  /** Zoom centrado en (cx, cy) relativo al wrap. */
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

  // ── Rueda del mouse ──────────────────────────────────────────
  function onWheel(e) {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
  }

  // ── Pointer (mouse drag + doble-click) ──────────────────────
  function onPointerDown(e) {
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
    if (scale > 1.5) { reset(); }
    else { zoomAt(e.clientX - rect.left, e.clientY - rect.top, 2.5); }
  }

  // ── Touch (pinch + drag táctil) ──────────────────────────────
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
      dragState.current = {
        dragging: true,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        ox: offset.x,
        oy: offset.y,
      };
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
      const factor  = newDist / touchState.current.dist;
      touchState.current.dist = newDist;
      const wrap = wrapRef.current;
      if (wrap) {
        const rect = wrap.getBoundingClientRect();
        zoomAt(
          touchState.current.midX - rect.left,
          touchState.current.midY - rect.top,
          factor,
        );
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

  function zoomIn() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const { width, height } = wrap.getBoundingClientRect();
    zoomAt(width / 2, height / 2, 1.4);
  }

  function zoomOut() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const { width, height } = wrap.getBoundingClientRect();
    zoomAt(width / 2, height / 2, 0.7);
  }

  const transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
  const cursor    = scale > 1 ? 'grab' : 'zoom-in';

  // Todos los handlers en el wrap.
  // setPointerCapture se llama internamente en onPointerDown sobre containerRef.
  const handlers = {
    onDblClick:   onDoubleClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };

  return { scale, offset, reset, zoomIn, zoomOut, transform, cursor, handlers };
}
