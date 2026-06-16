/**
 * GraphEditor.js — DEPRECATED: usar EditorCampus (#/editar/:piso) tab Grafo.
 *
 * Herramienta dev-only para anotar el grafo de pasillos.
 *
 * Acceso: #/anotar/-1   (subsuelo)
 *         #/anotar/0    (planta baja)
 *         #/anotar/1    (1er piso)
 *         #/anotar/2    (2do piso)
 *
 * Flujo:
 *   • Modo AGREGAR (default): click en el plano → agrega nodo. Click en nodo → selecciona.
 *   • Modo CONECTAR: click en un nodo → selecciona; click en otro → arista.
 *   • Modo CADENA: click en el plano → agrega nodo y lo conecta al anterior automáticamente.
 *       Útil para trazar la línea central de un pasillo de un tirón.
 *       Click en un nodo existente → lo convierte en el "ancla" de la cadena.
 *       Escape → rompe la cadena sin salir del modo.
 *   • Drag en un nodo → reposiciona el waypoint.
 *   • Doble-click en un nodo → borrarlo.
 *   • "Copiar JSON" → exporta el JSON del piso al portapapeles.
 *   • "Importar borrador" → carga draft JSON del extractor (grafoPiso o nodes/edges).
 *   • "Resetear" → limpia todos los nodos/aristas del piso.
 *
 * Props:
 *   pisoNumero   {number}   -1 | 0 | 1 | 2
 *   todosLugares {Array}    lista de lugares enriquecidos (para mostrar pins de aulas)
 *   grafoInicial {Object}   contenido de grafo.json (para precargar los nodos existentes)
 *   onSalir      {Function} volver al buscador
 */
import { html } from 'htm/preact';
import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { usePanZoom } from '../lib/usePanZoom.js';
import { resolveAsset } from '../lib/campus.js';
import { screenToPercent, posPct } from '../lib/planoCoords.js';

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

let nodoSeq = 1; // autoincremento para IDs de nuevos nodos

const PREFIJOS_NODO = { '-1': 's-n', 0: 'n', 1: 'p1-n', 2: 'p2-n' };

function nuevoIdNodo(pisoNumero) {
  const prefijo = PREFIJOS_NODO[String(pisoNumero)] ?? 'n';
  return `${prefijo}${nodoSeq++}`;
}

export function GraphEditor({ pisoNumero, todosLugares, grafoInicial, onSalir }) {
  const pisoStr = String(pisoNumero);
  const plano   = resolveAsset(PLANOS[pisoNumero] ?? '');

  // Nodos del piso cargados de grafo.json (para contexto, en gris)
  const nodosExistentes   = grafoInicial?.pisos?.[pisoStr]?.nodos   ?? [];
  const aristasExistentes = grafoInicial?.pisos?.[pisoStr]?.aristas ?? [];

  // Estado editable de este piso
  const [nodos,   setNodos]   = useState(() => nodosExistentes.map((n) => ({ ...n })));
  const [aristas, setAristas] = useState(() => aristasExistentes.map((a) => [...a]));
  const [selId,   setSelId]   = useState(null); // nodo seleccionado (modo conectar)
  const [copiado, setCopiado] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  const fileInputRef = useRef(null);

  // Modo activo: 'agregar' | 'conectar' | 'cadena'
  const [modo, setModo] = useState('agregar');

  // Cadena: ID del último nodo colocado en modo cadena (ancla de la siguiente arista)
  const [lastChainId, setLastChainId] = useState(null);

  // Cursor: coordenadas % actuales del mouse sobre el plano
  const [cursorPct, setCursorPct] = useState(null);

  // Drag de nodos
  const dragRef = useRef(null); // { id, origX, origY, clientX, clientY, moved }

  const imgRef       = useRef(null);
  const wrapRef      = useRef(null);
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

  // ── Agregar arista (deduplicada) ──────────────────────────────────────────
  function agregarArista(a, b) {
    if (a === b) return;
    setAristas((prev) => {
      if (prev.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return prev;
      return [...prev, [a, b]];
    });
  }

  // ── Hover del mouse: actualizar cursorPct ────────────────────────────────
  function handleMouseMove(e) {
    // Ignorar si hay drag activo (la posición la maneja el drag)
    if (dragRef.current?.moved) return;
    setCursorPct(toPercent(e.clientX, e.clientY));
  }

  function handleMouseLeave() {
    setCursorPct(null);
  }

  // ── Click en el plano (área vacía) ───────────────────────────────────────
  function handlePlanoClick(e) {
    if (e.target.closest('.ge-node')) return; // lo maneja handleNodoPointerUp
    const pct = toPercent(e.clientX, e.clientY);
    if (!pct) return;

    if (modo === 'cadena') {
      const id = nuevoIdNodo(pisoNumero);
      setNodos((prev) => [...prev, { id, x: pct.x, y: pct.y }]);
      if (lastChainId) agregarArista(lastChainId, id);
      setLastChainId(id);
      return;
    }

    if (modo === 'agregar') {
      const id = nuevoIdNodo(pisoNumero);
      setNodos((prev) => [...prev, { id, x: pct.x, y: pct.y }]);
      setSelId(null);
      return;
    }

    // modo 'conectar': click en vacío deselecciona
    setSelId(null);
  }

  // ── Drag de nodo ─────────────────────────────────────────────────────────
  function handleNodoPointerDown(e, id) {
    e.stopPropagation(); // evitar que pan/zoom vea este evento
    e.currentTarget.setPointerCapture(e.pointerId);
    const n = nodos.find((nd) => nd.id === id);
    if (!n) return;
    dragRef.current = { id, origX: n.x, origY: n.y, clientX: e.clientX, clientY: e.clientY, moved: false };
  }

  function handleNodoPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const dist = Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY);
    if (dist > 5) drag.moved = true;
    if (!drag.moved) return;
    const pct = toPercent(e.clientX, e.clientY);
    if (!pct) return;
    setNodos((prev) => prev.map((nd) => nd.id === drag.id ? { ...nd, x: pct.x, y: pct.y } : nd));
  }

  function handleNodoPointerUp(e, id) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && drag.moved) return; // fue drag, no click

    // --- Lógica de click sobre un nodo ---
    if (modo === 'cadena') {
      // Convertir nodo existente en ancla de la cadena
      setLastChainId(id);
      return;
    }

    if (modo === 'conectar') {
      if (selId && selId !== id) {
        agregarArista(selId, id);
        setSelId(null);
      } else {
        setSelId((prev) => (prev === id ? null : id));
      }
      return;
    }

    // modo 'agregar': click selecciona/deselecciona
    setSelId((prev) => (prev === id ? null : id));
  }

  // ── Borrar nodo (doble-click) ─────────────────────────────────────────────
  function handleNodoDblClick(e, id) {
    e.stopPropagation();
    setNodos((prev) => prev.filter((n) => n.id !== id));
    setAristas((prev) => prev.filter(([a, b]) => a !== id && b !== id));
    if (selId === id) setSelId(null);
    if (lastChainId === id) setLastChainId(null);
  }

  // ── Tecla Escape: romper cadena ───────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setLastChainId(null);
        setSelId(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Cambiar modo ──────────────────────────────────────────────────────────
  function activarModo(nuevoModo) {
    setModo(nuevoModo);
    setSelId(null);
    if (nuevoModo !== 'cadena') setLastChainId(null);
  }

  // ── Exportar al portapapeles ──────────────────────────────────────────────
  function handleCopiar() {
    const data = { nodos, aristas };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
    console.log('[GraphEditor] pisos["' + pisoStr + '"]:', JSON.stringify(data, null, 2));
  }

  function handleReset() {
    if (!confirm('¿Borrar todos los nodos y aristas del piso?')) return;
    setNodos([]);
    setAristas([]);
    setSelId(null);
    setLastChainId(null);
    nodoSeq = 1;
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const piso = data.grafoPiso ?? {
          nodos: (data.nodes ?? []).map((n) => ({
            id: n.id,
            x: n.x,
            y: n.y,
            tipo: n.tipo ?? 'interseccion',
          })),
          aristas: (data.edges ?? []).map((edge) => {
            if (Array.isArray(edge)) return edge;
            return [edge.a ?? edge.from, edge.b ?? edge.to];
          }),
        };

        if (!piso.nodos?.length) {
          setImportMsg('El archivo no contiene nodos');
          return;
        }

        setNodos(piso.nodos.map((n) => ({ ...n })));
        setAristas((piso.aristas ?? []).map((a) => [...a]));
        setSelId(null);
        setLastChainId(null);

        const maxSeq = piso.nodos.reduce((m, n) => {
          const match = String(n.id).match(/(\d+)$/);
          return match ? Math.max(m, parseInt(match[1], 10)) : m;
        }, 0);
        nodoSeq = maxSeq + 1;

        setImportMsg(`Importados ${piso.nodos.length} nodos, ${(piso.aristas ?? []).length} aristas`);
        setTimeout(() => setImportMsg(null), 3000);
      } catch (err) {
        setImportMsg(`Error al leer JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  const nodosMap = {};
  for (const n of nodos) nodosMap[n.id] = n;

  const lugaresPiso = todosLugares.filter((l) => l.pisoNumero === pisoNumero);

  // Posición del ancla de cadena (para línea de previsualización)
  const anclaChain = lastChainId ? nodosMap[lastChainId] : null;

  // Texto de ayuda según modo
  const HINTS = {
    agregar: 'Click en el plano → agrega nodo · Click en nodo → seleccionar · Doble-click → borrar · Drag → mover',
    conectar: 'Click en un nodo para seleccionarlo, luego click en otro para crear arista · Esc = deseleccionar',
    cadena:   'Click en el plano → agrega nodo y conecta al anterior · Click en nodo existente → anclar cadena ahí · Esc = romper cadena',
  };

  return html`
    <div class="floorplan-view ge-view">
      <!-- Topbar -->
      <div class="floorplan-topbar">
        <button class="btn-back" onClick=${onSalir} type="button">← Salir</button>
        <span class="floorplan-title">
          🛠️ Editor · ${ETIQUETA[pisoNumero] ?? pisoStr}
        </span>
        <button class="btn-reset-zoom" onClick=${reset} type="button" title="Reset zoom">⊡</button>
      </div>

      <!-- Controles -->
      <div class="ge-toolbar">
        <button
          class=${`ge-tool-btn${modo === 'agregar' ? ' ge-tool-btn--activo' : ''}`}
          type="button"
          onClick=${() => activarModo('agregar')}
          title="Modo agregar nodos"
        >➕ Agregar</button>

        <button
          class=${`ge-tool-btn${modo === 'conectar' ? ' ge-tool-btn--activo' : ''}`}
          type="button"
          onClick=${() => activarModo('conectar')}
          title="Modo conectar nodos con aristas"
        >🔗 Conectar</button>

        <button
          class=${`ge-tool-btn${modo === 'cadena' ? ' ge-tool-btn--activo' : ''}`}
          type="button"
          onClick=${() => activarModo('cadena')}
          title="Modo cadena: trazar pasillo de un tirón"
        >〰️ Cadena${lastChainId ? ` (${lastChainId})` : ''}</button>

        <span class="ge-stat">${nodos.length} nodos · ${aristas.length} aristas</span>

        <span class="ge-cursor-coord">
          ${cursorPct ? `${cursorPct.x.toFixed(1)}, ${cursorPct.y.toFixed(1)}` : '—, —'}
        </span>

        <button
          class="ge-tool-btn"
          type="button"
          onClick=${handleCopiar}
          title="Copiar JSON del piso al portapapeles"
        >${copiado ? '✓ Copiado' : '📋 Copiar JSON'}</button>

        <button
          class="ge-tool-btn"
          type="button"
          onClick=${handleImportClick}
          title="Importar borrador del extractor (draft-*.json)"
        >📥 Importar borrador</button>
        <input
          ref=${fileInputRef}
          type="file"
          accept="application/json,.json"
          style="display:none"
          onChange=${handleImportFile}
        />

        <button
          class="ge-tool-btn ge-tool-btn--danger"
          type="button"
          onClick=${handleReset}
          title="Borrar todos los nodos y aristas"
        >🗑️ Resetear</button>
      </div>

      <p class="floorplan-hint ge-hint">
        <strong>${modo === 'agregar' ? 'Agregar' : modo === 'conectar' ? 'Conectar' : 'Cadena'}:</strong>
        ${HINTS[modo]}
        ${selId ? html` · Seleccionado: <code>${selId}</code>` : ''}
        ${importMsg ? html` · <em>${importMsg}</em>` : ''}
      </p>

      <!-- Visor interactivo -->
      <div
        class="floorplan-wrap"
        ref=${wrapRef}
        ...${handlers}
        onClick=${handlePlanoClick}
        onMouseMove=${handleMouseMove}
        onMouseLeave=${handleMouseLeave}
        style=${{ touchAction: 'none', cursor: modo === 'conectar' ? 'crosshair' : 'default' }}
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

          <!-- Pins de aulas (referencia, no interactivos) -->
          ${lugaresPiso.map((l) => html`
            <div
              key=${l.id}
              class="ge-lugar-pin"
              style=${{ ...posPct(l.coord), pointerEvents: 'none' }}
              title=${l.nombre}
            >
              <div class="ge-lugar-dot"></div>
            </div>
          `)}

          <!-- SVG: aristas + línea de previsualización de cadena -->
          <svg class="route-svg ge-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            ${aristas.map(([a, b]) => {
              const na = nodosMap[a];
              const nb = nodosMap[b];
              if (!na || !nb) return null;
              const highlight = (a === selId || b === selId) || (a === lastChainId || b === lastChainId);
              return html`
                <line
                  key=${a + '-' + b}
                  x1=${na.x} y1=${na.y}
                  x2=${nb.x} y2=${nb.y}
                  stroke=${highlight ? '#f59e0b' : '#3b82f6'}
                  stroke-width="0.6"
                  vector-effect="non-scaling-stroke"
                />
              `;
            })}
            ${anclaChain && cursorPct ? html`
              <line
                x1=${anclaChain.x} y1=${anclaChain.y}
                x2=${cursorPct.x} y2=${cursorPct.y}
                stroke="#22c55e"
                stroke-width="0.5"
                stroke-dasharray="2,1.5"
                vector-effect="non-scaling-stroke"
                pointer-events="none"
              />
            ` : null}
          </svg>

          <!-- Nodos de corredor -->
          ${nodos.map((n) => html`
            <div
              key=${n.id}
              class=${`ge-node${n.id === selId ? ' ge-node--sel' : ''}${n.id === lastChainId ? ' ge-node--chain' : ''}`}
              style=${posPct(n)}
              onPointerDown=${(e) => handleNodoPointerDown(e, n.id)}
              onPointerMove=${handleNodoPointerMove}
              onPointerUp=${(e) => handleNodoPointerUp(e, n.id)}
              onDblClick=${(e) => handleNodoDblClick(e, n.id)}
              title=${`${n.id} (${n.x}, ${n.y})`}
              role="button"
              tabindex="0"
            >
              <div class="ge-node-dot"></div>
              <span class="ge-node-label">${n.id}</span>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}
