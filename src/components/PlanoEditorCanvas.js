/**
 * PlanoEditorCanvas.js — lienzo compartido del editor (plano + pan/zoom + cursor %).
 */
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { screenToPercent } from '../lib/planoCoords.js';

/**
 * @param {{
 *   plano: string,
 *   etiqueta: string,
 *   wrapRef: import('preact').RefObject<HTMLElement>,
 *   containerRef: import('preact').RefObject<HTMLElement>,
 *   imgRef: import('preact').RefObject<HTMLImageElement>,
 *   transform: string,
 *   scale: number,
 *   offset: { x: number, y: number },
 *   handlers: object,
 *   onPlanoClick?: Function,
 *   cursorStyle?: string,
 *   overlayImg?: string|null,
 *   overlayClass?: string,
 *   overlayOpacity?: number,
 *   onPlanoLoad?: Function,
 *   onCursorChange?: Function,
 *   children?: import('preact').ComponentChildren,
 * }} props
 */
export function PlanoEditorCanvas({
  plano,
  etiqueta,
  wrapRef,
  containerRef,
  imgRef,
  transform,
  scale,
  offset,
  handlers,
  onPlanoClick,
  cursorStyle = 'default',
  overlayImg = null,
  overlayClass = 'ed-overlay-validacion',
  overlayOpacity = 0.55,
  onPlanoLoad,
  onCursorChange,
  children,
}) {
  const [cursorPct, setCursorPct] = useState(null);

  function toPercent(clientX, clientY) {
    return screenToPercent(clientX, clientY, {
      wrapEl: wrapRef.current,
      imgEl: imgRef.current,
      scale,
      offset,
    });
  }

  function handleMouseMove(e) {
    const pct = toPercent(e.clientX, e.clientY);
    setCursorPct(pct);
    onCursorChange?.(pct);
  }

  function handleMouseLeave() {
    setCursorPct(null);
    onCursorChange?.(null);
  }

  function handleClick(e) {
    if (e.target.closest('.ge-node, .cal-pin, .ed-puerta-pin')) return;
    const pct = toPercent(e.clientX, e.clientY);
    if (pct) onPlanoClick?.(pct, e);
  }

  return html`
    <div
      class="floorplan-wrap"
      ref=${wrapRef}
      ...${handlers}
      onClick=${handleClick}
      onMouseMove=${handleMouseMove}
      onMouseLeave=${handleMouseLeave}
      style=${{ touchAction: 'none', cursor: cursorStyle }}
    >
      <div
        class="floorplan-container"
        ref=${containerRef}
        style=${{
          transform,
          transformOrigin: '0 0',
          willChange: 'transform',
          transition: 'transform 0.1s ease-out',
        }}
      >
        <img
          ref=${imgRef}
          src=${plano}
          alt=${`Plano ${etiqueta}`}
          class="floorplan-img"
          crossOrigin="anonymous"
          draggable="false"
          onLoad=${() => onPlanoLoad?.()}
        />
        ${overlayImg ? html`
          <img
            src=${overlayImg}
            alt="Overlay del plano"
            class=${`floorplan-img ${overlayClass}`}
            style=${{ opacity: overlayOpacity }}
            draggable="false"
          />
        ` : null}
        ${children}
      </div>
    </div>
    <span class="ge-cursor-coord ge-cursor-coord--hidden" data-cursor=${cursorPct
      ? `${cursorPct.x.toFixed(1)}, ${cursorPct.y.toFixed(1)}`
      : '—, —'} />
  `;
}

/** Expone toPercent para drag handlers externos. */
export function crearToPercent(wrapRef, imgRef, scale, offset) {
  return (clientX, clientY) => screenToPercent(clientX, clientY, {
    wrapEl: wrapRef.current,
    imgEl: imgRef.current,
    scale,
    offset,
  });
}
