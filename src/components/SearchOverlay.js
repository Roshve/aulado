/**
 * SearchOverlay.js — wrapper flotante sobre el mapa que encapsula el estado de búsqueda.
 *
 * Dueño de query y tiposFiltro; App es el único escritor de window.history
 * (recibe onSearchSync para propagar cambios sin carrera de replaceState).
 *
 * Props:
 *   todosLugares     {Array}      lista completa de lugares (aplanarLugares)
 *   fuse             {Fuse}       instancia del buscador fuzzy
 *   onSeleccion      {Function}   callback(lugar) al tocar un resultado
 *   favoritos        {Set}        IDs favoritos
 *   recientes        {Array}      lugares recientes
 *   paradas          {Array}      paradas activas
 *   onToggleParada   {Function}
 *   onLimpiarParadas {Function}
 *   searchInicial    {{q,tipos}}  seed desde parseSearchParams() para hidratar al montar
 *   onSearchSync     {Function}   callback(q, tipos) para que App actualice location.search
 *   oculto           {boolean}    si true, el overlay se oculta (CSS display:none) pero mantiene estado
 */
import { html } from 'htm/preact';
import { useState, useMemo, useEffect } from 'preact/hooks';
import { filtrarLugares } from '../lib/search.js';
import { SearchBar } from './SearchBar.js';

export function SearchOverlay({
  todosLugares,
  fuse,
  onSeleccion,
  favoritos,
  recientes,
  paradas,
  onToggleParada,
  onLimpiarParadas,
  searchInicial,
  onSearchSync,
  oculto,
}) {
  const [query, setQuery] = useState(() => searchInicial?.q ?? '');
  const [tiposFiltro, setTiposFiltro] = useState(() => searchInicial?.tipos ?? []);

  const resultados = useMemo(
    () => filtrarLugares(fuse, query, todosLugares, tiposFiltro),
    [fuse, query, todosLugares, tiposFiltro],
  );

  useEffect(() => {
    onSearchSync?.(query, tiposFiltro);
  }, [query, tiposFiltro]);

  return html`
    <div class=${'search-overlay' + (oculto ? ' search-overlay--oculto' : '')}>
      <${SearchBar}
        query=${query}
        onQuery=${setQuery}
        tiposFiltro=${tiposFiltro}
        onTiposFiltro=${setTiposFiltro}
        resultados=${resultados}
        todosLugares=${todosLugares}
        onSeleccion=${onSeleccion}
        favoritos=${favoritos}
        recientes=${recientes}
        paradas=${paradas}
        onToggleParada=${onToggleParada}
        onLimpiarParadas=${onLimpiarParadas}
      />
    </div>
  `;
}
