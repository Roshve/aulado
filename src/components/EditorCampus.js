/**
 * EditorCampus.js — editor unificado de campus.json + grafo.json por piso.
 *
 * Acceso: #/editar/:piso
 * Alias:  #/anotar/:piso → tab grafo · #/calibrar/:piso → tab lugares
 */
import { html } from 'htm/preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { usePanZoom } from '../lib/usePanZoom.js';
import { getPisoInfo, prefijoNodo, overlayVerificacionSlug } from '../lib/planosRegistry.js';
import { posPct } from '../lib/planoCoords.js';
import {
  exportPisoCompleto,
  grafoFragmento,
  campusFragmento,
  parseImportGrafo,
  parseImportPuertas,
  aplicarSugerenciasPuertas,
  downloadJson,
  nombreArchivoExport,
} from '../lib/editorExport.js';
import { calcularSpurLugar, calcularSpurPuerta, spursDelPiso } from '../lib/editorSpurs.js';
import { overlayMascaraDesdeImagen, BRILLO_PARED_DEFAULT } from '../lib/editorMascaraParedes.js';
import { puertasDe, serializarPuertas, etiquetaPuerta, clonarPuertasCampo } from '../lib/puertasLugar.js';
import { PlanoEditorCanvas, crearToPercent } from './PlanoEditorCanvas.js';

const TABS = [
  { id: 'grafo', label: 'Grafo', icon: '🔗' },
  { id: 'lugares', label: 'Lugares', icon: '📍' },
  { id: 'puertas', label: 'Puertas', icon: '🚪' },
  { id: 'paredes', label: 'Paredes', icon: '🧱' },
  { id: 'validacion', label: 'Validación', icon: '✓' },
];

let nodoSeq = 1;

function clonarLugaresPiso(todosLugares, pisoNumero) {
  return todosLugares
    .filter((l) => l.pisoNumero === pisoNumero)
    .map((l) => {
      const { puerta, puertas, ...rest } = l;
      return {
        ...rest,
        coord: { ...l.coord },
        ...clonarPuertasCampo(l),
      };
    });
}

function actualizarPuertas(prev, lugarId, updater) {
  return prev.map((l) => {
    if (l.id !== lugarId) return l;
    const { puerta, puertas, ...rest } = l;
    const next = updater(puertasDe(l));
    return { ...rest, ...serializarPuertas(next) };
  });
}

function initNodoSeq(nodos) {
  const maxSeq = nodos.reduce((m, n) => {
    const match = String(n.id).match(/(\d+)$/);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  nodoSeq = maxSeq + 1;
}

export function EditorCampus({
  pisoNumero,
  pisoEtiqueta,
  plano,
  tabInicial = 'grafo',
  todosLugares,
  grafoInicial,
  pisos,
  onSalir,
  onCambioPiso,
}) {
  const pisoStr = String(pisoNumero);
  const nodosExistentes = grafoInicial?.pisos?.[pisoStr]?.nodos ?? [];
  const aristasExistentes = grafoInicial?.pisos?.[pisoStr]?.aristas ?? [];

  const [tab, setTab] = useState(tabInicial);
  const [nodos, setNodos] = useState(() => nodosExistentes.map((n) => ({ ...n })));
  const [aristas, setAristas] = useState(() => aristasExistentes.map((a) => [...a]));
  const [lugares, setLugares] = useState(() => clonarLugaresPiso(todosLugares, pisoNumero));
  const [modo, setModo] = useState('agregar');
  const [selId, setSelId] = useState(null);
  const [selLugarId, setSelLugarId] = useState(null);
  const [selPuertaIdx, setSelPuertaIdx] = useState(0);
  const [lastChainId, setLastChainId] = useState(null);
  const [cursorPct, setCursorPct] = useState(null);
  const [copiado, setCopiado] = useState(null);
  const [importMsg, setImportMsg] = useState(null);
  const [overlayValidacion, setOverlayValidacion] = useState(null);
  const [reporteValidacion, setReporteValidacion] = useState(null);
  const [mostrarSpurs, setMostrarSpurs] = useState(true);
  const [overlayParedes, setOverlayParedes] = useState(null);
  const [mascaraCargando, setMascaraCargando] = useState(false);
  const [umbralPared, setUmbralPared] = useState(BRILLO_PARED_DEFAULT);
  const [opacidadPared, setOpacidadPared] = useState(0.75);
  const [mostrarParedesGrafo, setMostrarParedesGrafo] = useState(false);
  const [mascaraKey, setMascaraKey] = useState(0);

  const dragNodoRef = useRef(null);
  const dragPinRef = useRef(null);
  const dragPuertaRef = useRef(null);
  const fileGrafoRef = useRef(null);
  const filePuertasRef = useRef(null);
  const fileOverlayRef = useRef(null);
  const fileReporteRef = useRef(null);
  const imgRef = useRef(null);
  const wrapRef = useRef(null);
  const containerRef = useRef(null);

  const { scale, offset, transform, reset, handlers } =
    usePanZoom({ wrapRef, containerRef });

  useEffect(() => {
    initNodoSeq(nodosExistentes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pisoNumero]);

  useEffect(() => {
    setTab(tabInicial);
  }, [tabInicial, pisoNumero]);

  // Recargar datos al cambiar piso
  useEffect(() => {
    const n = grafoInicial?.pisos?.[pisoStr]?.nodos ?? [];
    const a = grafoInicial?.pisos?.[pisoStr]?.aristas ?? [];
    setNodos(n.map((x) => ({ ...x })));
    setAristas(a.map((x) => [...x]));
    setLugares(clonarLugaresPiso(todosLugares, pisoNumero));
    setSelId(null);
    setSelLugarId(null);
    setSelPuertaIdx(0);
    setLastChainId(null);
    setOverlayValidacion(null);
    setReporteValidacion(null);
    setOverlayParedes(null);
    initNodoSeq(n);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pisoNumero]);

  function toPercent(clientX, clientY) {
    return crearToPercent(wrapRef, imgRef, scale, offset)(clientX, clientY);
  }

  function nuevoIdNodo() {
    return `${prefijoNodo(pisoNumero)}${nodoSeq++}`;
  }

  function agregarArista(a, b) {
    if (a === b) return;
    setAristas((prev) => {
      if (prev.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return prev;
      return [...prev, [a, b]];
    });
  }

  function activarModo(nuevoModo) {
    setModo(nuevoModo);
    setSelId(null);
    if (nuevoModo !== 'cadena') setLastChainId(null);
  }

  function handlePlanoClick(pct) {
    if (tab === 'grafo') {
      if (modo === 'cadena') {
        const id = nuevoIdNodo();
        setNodos((prev) => [...prev, { id, x: pct.x, y: pct.y }]);
        if (lastChainId) agregarArista(lastChainId, id);
        setLastChainId(id);
        return;
      }
      if (modo === 'agregar') {
        const id = nuevoIdNodo();
        setNodos((prev) => [...prev, { id, x: pct.x, y: pct.y }]);
        setSelId(null);
      } else {
        setSelId(null);
      }
    } else if (tab === 'puertas' && selLugarId) {
      setLugares((prev) => actualizarPuertas(prev, selLugarId, (puertas) => {
        const idx = selPuertaIdx < puertas.length ? selPuertaIdx : puertas.length;
        const spur = calcularSpurPuerta({ x: pct.x, y: pct.y }, null, nodos, aristas);
        const nueva = {
          x: pct.x,
          y: pct.y,
          ...(spur?.join ? { join: spur.join } : {}),
        };
        if (idx >= puertas.length) return [...puertas, nueva];
        return puertas.map((p, i) => (i === idx ? { ...p, ...nueva } : p));
      }));
    } else if (tab === 'lugares') {
      setSelLugarId(null);
    setSelPuertaIdx(0);
    }
  }

  function handleNodoPointerDown(e, id) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const n = nodos.find((nd) => nd.id === id);
    if (!n) return;
    dragNodoRef.current = { id, origX: n.x, origY: n.y, clientX: e.clientX, clientY: e.clientY, moved: false };
  }

  function handleNodoPointerMove(e) {
    const drag = dragNodoRef.current;
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY) > 5) drag.moved = true;
    if (!drag.moved) return;
    const pct = toPercent(e.clientX, e.clientY);
    if (!pct) return;
    setNodos((prev) => prev.map((nd) => nd.id === drag.id ? { ...nd, x: pct.x, y: pct.y } : nd));
  }

  function handleNodoPointerUp(e, id) {
    const drag = dragNodoRef.current;
    dragNodoRef.current = null;
    if (drag?.moved) return;

    if (tab !== 'grafo') return;

    if (modo === 'cadena') {
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
    setSelId((prev) => (prev === id ? null : id));
  }

  function handleNodoDblClick(e, id) {
    e.stopPropagation();
    setNodos((prev) => prev.filter((n) => n.id !== id));
    setAristas((prev) => prev.filter(([a, b]) => a !== id && b !== id));
    if (selId === id) setSelId(null);
    if (lastChainId === id) setLastChainId(null);
  }

  function handlePinPointerDown(e, id) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragPinRef.current = { id, clientX: e.clientX, clientY: e.clientY, moved: false };
  }

  function handlePinPointerMove(e) {
    const drag = dragPinRef.current;
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY) > 5) drag.moved = true;
    if (!drag.moved) return;
    const pct = toPercent(e.clientX, e.clientY);
    if (!pct) return;
    setLugares((prev) => prev.map((l) =>
      l.id === drag.id ? { ...l, coord: { x: pct.x, y: pct.y } } : l,
    ));
  }

  function handlePinPointerUp(e, id) {
    const drag = dragPinRef.current;
    dragPinRef.current = null;
    if (drag?.moved) return;
    setSelLugarId((prev) => (prev === id ? null : id));
    setSelPuertaIdx(0);
  }

  function handlePuertaPointerDown(e, id, idx) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragPuertaRef.current = { id, idx, clientX: e.clientX, clientY: e.clientY, moved: false };
  }

  function handlePuertaPointerMove(e) {
    const drag = dragPuertaRef.current;
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY) > 5) drag.moved = true;
    if (!drag.moved) return;
    const pct = toPercent(e.clientX, e.clientY);
    if (!pct) return;
    setLugares((prev) => actualizarPuertas(prev, drag.id, (puertas) => {
      if (!puertas[drag.idx]) return puertas;
      const spur = calcularSpurPuerta({ x: pct.x, y: pct.y }, puertas[drag.idx].join ?? null, nodos, aristas);
      return puertas.map((p, i) => (i === drag.idx ? {
        ...p,
        x: pct.x,
        y: pct.y,
        ...(spur?.join ? { join: spur.join } : {}),
      } : p));
    }));
  }

  function handlePuertaPointerUp(e, id, idx) {
    const drag = dragPuertaRef.current;
    dragPuertaRef.current = null;
    if (drag?.moved) return;
    setSelLugarId(id);
    setSelPuertaIdx(idx);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setLastChainId(null);
        setSelId(null);
        setSelLugarId(null);
    setSelPuertaIdx(0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const necesitaMascara = tab === 'paredes' || (tab === 'grafo' && mostrarParedesGrafo);

  function generarMascaraParedes() {
    if (!necesitaMascara) return;
    const img = imgRef.current;
    if (!img?.complete || !img.naturalWidth) return;

    setMascaraCargando(true);
    window.requestAnimationFrame(() => {
      const url = overlayMascaraDesdeImagen(img, { umbral: umbralPared });
      setOverlayParedes(url);
      setMascaraCargando(false);
    });
  }

  useEffect(() => {
    generarMascaraParedes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [necesitaMascara, umbralPared, pisoNumero, plano, mascaraKey]);

  function handleRecalcularMascara() {
    setMascaraKey((k) => k + 1);
  }

  function handlePlanoLoad() {
    if (necesitaMascara) generarMascaraParedes();
  }

  function flashCopiado(tipo) {
    setCopiado(tipo);
    setTimeout(() => setCopiado(null), 2500);
  }

  function copiarTexto(texto, tipo) {
    navigator.clipboard.writeText(texto).then(() => flashCopiado(tipo));
    console.log(`[EditorCampus] ${tipo}:`, texto);
  }

  function handleExportCompleto() {
    const data = exportPisoCompleto({ pisoNumero, pisoEtiqueta, nodos, aristas, lugares });
    downloadJson(data, nombreArchivoExport(pisoNumero, pisoEtiqueta));
    flashCopiado('download');
  }

  function handleCopiarGrafo() {
    copiarTexto(JSON.stringify(grafoFragmento(nodos, aristas), null, 2), 'grafo');
  }

  function handleCopiarCampus() {
    copiarTexto(JSON.stringify(campusFragmento(lugares), null, 2), 'campus');
  }

  function handleResetGrafo() {
    if (!confirm('¿Borrar todos los nodos y aristas del piso?')) return;
    setNodos([]);
    setAristas([]);
    setSelId(null);
    setLastChainId(null);
    nodoSeq = 1;
  }

  function handleImportGrafo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const draft = data.grafo ? { nodos: data.grafo.nodos, aristas: data.grafo.aristas } : data;
        const { nodos: nn, aristas: aa } = parseImportGrafo(draft);
        setNodos(nn);
        setAristas(aa);
        setSelId(null);
        setLastChainId(null);
        initNodoSeq(nn);
        setImportMsg(`Importados ${nn.length} nodos, ${aa.length} aristas`);
        setTimeout(() => setImportMsg(null), 3000);
      } catch (err) {
        setImportMsg(`Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  function handleImportPuertas(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const sugerencias = parseImportPuertas(data);
        setLugares((prev) => aplicarSugerenciasPuertas(prev, sugerencias));
        setImportMsg(`Puertas aplicadas: ${sugerencias.length} entradas`);
        setTimeout(() => setImportMsg(null), 3000);
      } catch (err) {
        setImportMsg(`Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  function handleImportOverlay(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setOverlayValidacion(reader.result);
      setImportMsg('Overlay cargado');
      setTimeout(() => setImportMsg(null), 3000);
    };
    reader.readAsDataURL(file);
  }

  function handleImportReporte(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setReporteValidacion(JSON.parse(reader.result));
      } catch {
        setImportMsg('Reporte JSON inválido');
      }
    };
    reader.readAsText(file);
  }

  function togglePuerta(lugarId) {
    setLugares((prev) => actualizarPuertas(prev, lugarId, (puertas) => {
      if (puertas.length === 0) return puertas;
      const idx = lugarId === selLugarId ? selPuertaIdx : 0;
      const next = puertas.filter((_, i) => i !== idx);
      if (lugarId === selLugarId) {
        setSelPuertaIdx(Math.max(0, Math.min(idx, next.length - 1)));
      }
      return next;
    }));
  }

  function agregarPuerta(lugarId) {
    const lugar = lugares.find((l) => l.id === lugarId);
    if (!lugar) return;
    const spur = calcularSpurLugar(lugar, nodos, aristas);
    if (!spur) return;
    setLugares((prev) => actualizarPuertas(prev, lugarId, (puertas) => [
      ...puertas,
      {
        x: spur.destino.x,
        y: spur.destino.y,
        join: spur.join,
      },
    ]));
    setSelLugarId(lugarId);
    setSelPuertaIdx(puertasDe(lugar).length);
  }

  function setJoinManual(lugarId, join, puertaIdx = selPuertaIdx) {
    setLugares((prev) => actualizarPuertas(prev, lugarId, (puertas) => {
      if (!puertas[puertaIdx]) return puertas;
      return puertas.map((p, i) => {
        if (i !== puertaIdx) return p;
        const next = { ...p };
        if (join) next.join = join;
        else delete next.join;
        return next;
      });
    }));
  }

  const nodosMap = Object.fromEntries(nodos.map((n) => [n.id, n]));
  const anclaChain = lastChainId ? nodosMap[lastChainId] : null;
  const resumen = exportPisoCompleto({ pisoNumero, pisoEtiqueta, nodos, aristas, lugares }).resumen;
  const spurs = spursDelPiso(lugares, nodos, aristas);
  const selLugar = selLugarId ? lugares.find((l) => l.id === selLugarId) : null;
  const selPuertas = selLugar ? puertasDe(selLugar) : [];
  const selPuerta = selPuertas[selPuertaIdx] ?? null;
  const pinsPuerta = lugares.flatMap((l) => puertasDe(l).map((p, i) => ({ l, p, i })));
  const overlaySlug = overlayVerificacionSlug(pisoNumero, pisoEtiqueta);

  const HINTS = {
    grafo: {
      agregar: 'Click en el plano → nodo · Click nodo → seleccionar · Doble-click → borrar · Drag → mover',
      conectar: 'Click nodo → seleccionar, click otro → arista · Esc = deseleccionar',
      cadena: 'Click plano → nodo conectado al anterior · Click nodo existente → anclar · Esc = romper',
    },
    lugares: 'Arrastrá cada pin al centro del lugar · Click para seleccionar',
    puertas: 'Seleccioná un lugar · Arrastrá el pin naranja (puerta) · Click en plano coloca puerta',
    paredes: 'Violeta = pared detectada (brillo < umbral) · Para corregir, editá el PNG (paredes oscuras) y re-ejecutá verificar_grafo.py',
    validacion: `Corré: python3 scripts/verificar_grafo.py --solo-piso ${pisoNumero} · Cargá scripts/preview/grafo-${overlaySlug}.png`,
  };

  const overlayActivo = tab === 'validacion'
    ? overlayValidacion
    : necesitaMascara
      ? overlayParedes
      : null;
  const overlayClassActivo = tab === 'validacion' ? 'ed-overlay-validacion' : 'ed-overlay-paredes';
  const overlayOpacityActivo = tab === 'validacion' ? 0.55 : opacidadPared;

  const cursorStyle = tab === 'grafo' && modo === 'conectar' ? 'crosshair' : 'default';

  return html`
    <div class="floorplan-view ed-view">
      <div class="floorplan-topbar">
        <button class="btn-back" onClick=${onSalir} type="button">← Salir</button>
        <span class="floorplan-title">
          🛠️ Editor · ${pisoEtiqueta ?? pisoStr}
        </span>
        ${pisos.length > 1 ? html`
          <select
            class="ed-piso-select"
            value=${pisoNumero}
            onChange=${(e) => onCambioPiso?.(parseInt(e.target.value, 10))}
            aria-label="Cambiar piso"
          >
            ${pisos.map((p) => html`
              <option key=${p.numero} value=${p.numero}>${p.etiqueta}</option>
            `)}
          </select>
        ` : null}
        <button class="btn-reset-zoom" onClick=${reset} type="button" title="Reset zoom">⊡</button>
      </div>

      <nav class="ed-tabs" aria-label="Modo de edición">
        ${TABS.map((t) => html`
          <button
            key=${t.id}
            type="button"
            class=${`ed-tab${tab === t.id ? ' ed-tab--activo' : ''}`}
            aria-selected=${tab === t.id}
            onClick=${() => setTab(t.id)}
          >
            ${t.icon} ${t.label}
          </button>
        `)}
      </nav>

      <div class="ge-toolbar ed-toolbar">
        ${tab === 'grafo' && html`
          <button class=${`ge-tool-btn${modo === 'agregar' ? ' ge-tool-btn--activo' : ''}`} type="button"
            onClick=${() => activarModo('agregar')}>➕ Agregar</button>
          <button class=${`ge-tool-btn${modo === 'conectar' ? ' ge-tool-btn--activo' : ''}`} type="button"
            onClick=${() => activarModo('conectar')}>🔗 Conectar</button>
          <button class=${`ge-tool-btn${modo === 'cadena' ? ' ge-tool-btn--activo' : ''}`} type="button"
            onClick=${() => activarModo('cadena')}>〰️ Cadena${lastChainId ? ` (${lastChainId})` : ''}</button>
          <button class="ge-tool-btn ge-tool-btn--danger" type="button" onClick=${handleResetGrafo}>🗑️ Resetear</button>
          <label class="ge-tool-btn" style="cursor:pointer">
            📥 Importar borrador
            <input ref=${fileGrafoRef} type="file" accept="application/json,.json" style="display:none"
              onChange=${handleImportGrafo} />
          </label>
        `}

        ${tab === 'puertas' && html`
          <label class="ge-tool-btn" style="cursor:pointer">
            📥 Importar puertas
            <input ref=${filePuertasRef} type="file" accept="application/json,.json" style="display:none"
              onChange=${handleImportPuertas} />
          </label>
        `}

        ${tab === 'paredes' && html`
          <label class="ge-tool-btn ed-slider-label">
            Umbral
            <input type="range" min="100" max="180" step="5" value=${umbralPared}
              onInput=${(e) => setUmbralPared(parseInt(e.target.value, 10))} />
            <span>${umbralPared}</span>
          </label>
          <label class="ge-tool-btn ed-slider-label">
            Opacidad
            <input type="range" min="0.2" max="0.8" step="0.05" value=${opacidadPared}
              onInput=${(e) => setOpacidadPared(parseFloat(e.target.value))} />
          </label>
          <button class="ge-tool-btn" type="button" onClick=${handleRecalcularMascara}
            disabled=${mascaraCargando}>
            ${mascaraCargando ? 'Calculando…' : '🔄 Recalcular'}
          </button>
        `}

        ${tab === 'validacion' && html`
          <label class="ge-tool-btn" style="cursor:pointer">
            🖼️ Cargar overlay
            <input ref=${fileOverlayRef} type="file" accept="image/png,image/jpeg" style="display:none"
              onChange=${handleImportOverlay} />
          </label>
          <label class="ge-tool-btn" style="cursor:pointer">
            📄 Cargar reporte JSON
            <input ref=${fileReporteRef} type="file" accept="application/json,.json" style="display:none"
              onChange=${handleImportReporte} />
          </label>
        `}

        ${tab === 'grafo' && html`
          <label class="ge-tool-btn" style="cursor:pointer;margin-left:auto">
            <input type="checkbox" checked=${mostrarParedesGrafo}
              onChange=${(e) => setMostrarParedesGrafo(e.target.checked)} />
            Paredes
          </label>
          <label class="ge-tool-btn" style="cursor:pointer">
            <input type="checkbox" checked=${mostrarSpurs} onChange=${(e) => setMostrarSpurs(e.target.checked)} />
            Spurs
          </label>
        `}

        <span class="ge-stat ed-resumen">
          ${resumen.nodos} nodos · ${resumen.aristas} aristas · ${resumen.lugares} lugares · ${resumen.puertas} puertas
        </span>

        <span class="ge-cursor-coord">
          ${cursorPct ? `${cursorPct.x.toFixed(1)}, ${cursorPct.y.toFixed(1)}` : '—, —'}
        </span>

        <button class="ge-tool-btn" type="button" onClick=${handleCopiarGrafo}
          title="Copiar nodos/aristas">${copiado === 'grafo' ? '✓ Grafo' : '📋 Grafo'}</button>
        <button class="ge-tool-btn" type="button" onClick=${handleCopiarCampus}
          title="Copiar lugares">${copiado === 'campus' ? '✓ Campus' : '📋 Campus'}</button>
        <button class="ge-tool-btn" type="button" onClick=${handleExportCompleto}
          title="Descargar export completo">${copiado === 'download' ? '✓ Descargado' : '💾 Exportar'}</button>
      </div>

      <p class="floorplan-hint ge-hint">
        ${tab === 'grafo' ? html`
          <strong>${modo}:</strong> ${HINTS.grafo[modo]}
          ${selId ? html` · Seleccionado: <code>${selId}</code>` : ''}
        ` : html`<strong>${TABS.find((t) => t.id === tab)?.label}:</strong> ${HINTS[tab]}`}
        ${tab === 'paredes' && !mascaraCargando && !overlayParedes
          ? html` · <em class="ed-reporte-bad">No se pudo generar la máscara — probá Recalcular</em>`
          : null}
        ${importMsg ? html` · <em>${importMsg}</em>` : ''}
      </p>

      ${tab === 'puertas' && selLugar ? html`
        <div class="ed-puerta-panel">
          <code>${selLugar.id}</code>
          ${selPuerta
            ? html` · puerta ${selPuertas.length > 1 ? selPuertaIdx + 1 : ''}
              (${selPuerta.x.toFixed(1)}, ${selPuerta.y.toFixed(1)})
              join: <input class="ed-join-input" value=${selPuerta.join ?? ''}
                onInput=${(e) => setJoinManual(selLugar.id, e.target.value, selPuertaIdx)} placeholder="n1-n2" />`
            : html` · sin puerta`}
          <button type="button" class="ge-tool-btn" onClick=${() => agregarPuerta(selLugar.id)}>
            Agregar puerta
          </button>
          ${selPuerta ? html`
            <button type="button" class="ge-tool-btn" onClick=${() => togglePuerta(selLugar.id)}>
              Quitar puerta
            </button>
          ` : null}
        </div>
      ` : null}

      ${tab === 'validacion' && reporteValidacion ? html`
        <div class="ed-reporte-panel">
          ${reporteValidacion.ok
            ? html`<span class="ed-reporte-ok">✓ Sin cruces de pared</span>`
            : html`<span class="ed-reporte-bad">✗ ${reporteValidacion.totalCruces ?? '?'} cruces</span>`}
          ${(reporteValidacion.cruces ?? []).slice(0, 5).map((c) => html`
            <div key=${c.arista}>${c.arista}: ${c.tipo ?? 'arista'}</div>
          `)}
        </div>
      ` : null}

      <${PlanoEditorCanvas}
        plano=${plano}
        etiqueta=${pisoEtiqueta ?? pisoStr}
        wrapRef=${wrapRef}
        containerRef=${containerRef}
        imgRef=${imgRef}
        transform=${transform}
        scale=${scale}
        offset=${offset}
        handlers=${handlers}
        onPlanoClick=${handlePlanoClick}
        cursorStyle=${cursorStyle}
        overlayImg=${overlayActivo}
        overlayClass=${overlayClassActivo}
        overlayOpacity=${overlayOpacityActivo}
        onPlanoLoad=${handlePlanoLoad}
        onCursorChange=${setCursorPct}
      >
        ${(tab === 'grafo' || tab === 'puertas') && mostrarSpurs && spurs.map(({ lugar, puertaIdx, spur }) => html`
          <svg key=${`spur-${lugar.id}-${puertaIdx ?? 'c'}`} class="route-svg ge-svg ed-spur-svg" viewBox="0 0 100 100"
            preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%">
            <line
              x1=${spur.origen.x} y1=${spur.origen.y}
              x2=${spur.destino.x} y2=${spur.destino.y}
              stroke=${spur.lejos ? '#ef4444' : '#3b82f6'}
              stroke-width="0.4"
              stroke-opacity="0.6"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        `)}

        ${(tab === 'grafo' || tab === 'puertas' || tab === 'validacion') && html`
          <svg class="route-svg ge-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
            style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
            ${aristas.map(([a, b]) => {
              const na = nodosMap[a];
              const nb = nodosMap[b];
              if (!na || !nb) return null;
              const highlight = tab === 'grafo' && ((a === selId || b === selId) || (a === lastChainId || b === lastChainId));
              return html`
                <line key=${a + '-' + b}
                  x1=${na.x} y1=${na.y} x2=${nb.x} y2=${nb.y}
                  stroke=${highlight ? '#f59e0b' : '#3b82f6'}
                  stroke-width="0.6"
                  vector-effect="non-scaling-stroke"
                />
              `;
            })}
            ${tab === 'grafo' && anclaChain && cursorPct ? html`
              <line x1=${anclaChain.x} y1=${anclaChain.y} x2=${cursorPct.x} y2=${cursorPct.y}
                stroke="#22c55e" stroke-width="0.5" stroke-dasharray="2,1.5"
                vector-effect="non-scaling-stroke" />
            ` : null}
          </svg>
        `}

        ${tab === 'grafo' && nodos.map((n) => html`
          <div key=${n.id}
            class=${`ge-node${n.id === selId ? ' ge-node--sel' : ''}${n.id === lastChainId ? ' ge-node--chain' : ''}`}
            style=${posPct(n)}
            onPointerDown=${(e) => handleNodoPointerDown(e, n.id)}
            onPointerMove=${handleNodoPointerMove}
            onPointerUp=${(e) => handleNodoPointerUp(e, n.id)}
            onDblClick=${(e) => handleNodoDblClick(e, n.id)}
            title=${`${n.id} (${n.x}, ${n.y})`}
            role="button" tabindex="0">
            <div class="ge-node-dot"></div>
            <span class="ge-node-label">${n.id}</span>
          </div>
        `)}

        ${(tab === 'grafo' || tab === 'lugares') && lugares.map((l) => html`
          <div key=${`pin-${l.id}`}
            class=${`ge-lugar-pin cal-pin${l.id === selLugarId ? ' cal-pin--sel' : ''}`}
            style=${{ ...posPct(l.coord), pointerEvents: tab === 'lugares' ? 'auto' : 'none' }}
            onPointerDown=${tab === 'lugares' ? (e) => handlePinPointerDown(e, l.id) : undefined}
            onPointerMove=${tab === 'lugares' ? handlePinPointerMove : undefined}
            onPointerUp=${tab === 'lugares' ? (e) => handlePinPointerUp(e, l.id) : undefined}
            title=${l.nombre}>
            <div class="cal-pin-dot"></div>
            <span class="cal-pin-label">${l.id}</span>
          </div>
        `)}

        ${(tab === 'puertas' || tab === 'validacion') && pinsPuerta.map(({ l, p, i }) => html`
          <div key=${`puerta-${l.id}-${i}`}
            class=${`ed-puerta-pin${l.id === selLugarId && i === selPuertaIdx ? ' ed-puerta-pin--sel' : ''}`}
            style=${posPct(p)}
            onPointerDown=${tab === 'puertas' ? (e) => handlePuertaPointerDown(e, l.id, i) : undefined}
            onPointerMove=${tab === 'puertas' ? handlePuertaPointerMove : undefined}
            onPointerUp=${tab === 'puertas' ? (e) => handlePuertaPointerUp(e, l.id, i) : undefined}
            title=${`Puerta ${etiquetaPuerta(l.id, i, puertasDe(l).length)}`}
            role="button" tabindex="0">
            <div class="ed-puerta-dot"></div>
            <span class="ed-puerta-label">${etiquetaPuerta(l.id, i, puertasDe(l).length)}</span>
          </div>
        `)}
      <//>
    </div>
  `;
}

/** Resuelve tab inicial desde alias de hash. */
export function tabDesdeVista(vista) {
  if (vista === 'calibrar') return 'lugares';
  if (vista === 'anotar') return 'grafo';
  return 'grafo';
}

/** Info de piso para el editor. */
export function resolverPisoEditor(pisos, pisoNumero) {
  const info = getPisoInfo(pisos, pisoNumero);
  return {
    pisoNumero,
    pisoEtiqueta: info?.etiqueta ?? String(pisoNumero),
    plano: info?.plano ?? '',
  };
}
