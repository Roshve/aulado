# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # dev server at http://localhost:5173
pnpm build        # production build → dist/
pnpm test         # run all tests (vitest run)
pnpm test -- --reporter=verbose  # verbose output
npx vitest run src/lib/search.test.js  # run a single test file
```

Python scripts (graph editing / validation):

```bash
pip install -r scripts/requirements.txt

python3 -m scripts.extractor --piso 0       # extract draft graph from PNG → scripts/preview/draft-<slug>.json
python3 scripts/verificar_grafo.py          # CI gate: fails if edges cross walls
python3 scripts/verificar_grafo.py --json   # JSON report for EditorCampus validation tab
python3 scripts/sugerir_puertas.py --piso -1    # suggest door coords for spurs that cross walls
python3 scripts/actualizar_campus.py         # sync place coords from red circles in PNG
```

## Stack

- **Build**: Vite 6 (`base: '/aulado/'`) + `vite-plugin-pwa` (Workbox, autoUpdate)
- **UI**: Preact + `htm` (JSX-free tagged-template syntax — all JSX is `html\`...\``)
- **Map**: Leaflet + `CRS.Simple` (`src/lib/leafletCoords.js`, `src/lib/useLeafletMap.js`)
- **Search**: Fuse.js (fuzzy, diacritics-insensitive)
- **Tests**: Vitest, `environment: 'node'`
- **Routing**: hash-based (`#/lugar/:id`, `#/ruta/:origen/:destino`, `#/editar/:piso`)
- **URL state**: `?q=...&tipos=...` query params (separate from hash)

## Architecture

### Data model

Two source-of-truth JSON files:

- **`src/data/campus.json`** — buildings → floors → places. Each place has `id`, `nombre`, `tipo`, `coord: {x, y}` (percentage over the floor plan image), optional `sinonimos`, optional `puerta: {x, y, join?}`.
- **`src/data/grafo.json`** — navigation graph. `pisos[N].nodos` (corridor waypoints), `pisos[N].aristas` (edges), `verticales` (elevators/stairs linking floors). Coordinates are also percentages (`meta.escalaPx` gives the reference image size).

`src/lib/campus.js` flattens `campus.json` into a single array (`aplanarLugares`) enriching each place with `pisoNumero`, `pisoEtiqueta`, `planoPiso`, `edificioNombre`, `edificioApodos`. This flat array is the only thing the rest of the app consumes.

### Map-first shell

`App.js` is the single root component. **MapaCampus** (Leaflet) is the persistent canvas. Overlays float on top:

| State | Hash / URL | UI |
|-------|------------|-----|
| búsqueda | (no hash) + `?q=&tipos=` | `SearchOverlay` |
| ficha | `#/lugar/:id` (alias: `#/plano/:id`) | `BottomSheet` + `DestinationCard` |
| ruta | `#/ruta/:origenId/:destinoId` | `BottomSheet` + `RutaPanel` + polyline on map |
| editor | `#/editar/:piso` | `EditorCampus` full-screen overlay |

Other always-visible controls: `SelectorPiso` (floor picker), Leaflet zoom control.

`history.pushState` is used directly (no router library). `popstate` events re-hydrate state from the hash.

### Leaflet layers

- **`useLeafletMap.js`** — mounts CRS.Simple map, swaps `ImageOverlay` per floor, POI markers, route polyline
- **`leafletCoords.js`** — `pctALatLng({x,y})` converts campus % coords to Leaflet LatLng (Y inverted)
- **`mapPoiLayer.js`** — clickable POI markers with zoom-dependent labels
- **`mapRutaLayer.js`** — `L.polyline` for active route segment

### Routing (pathfinding)

`src/lib/routing.js` builds an in-memory graph at runtime by:
1. Adding corridor waypoints from `grafo.json`
2. Adding all campus places as nodes
3. Connecting places to the nearest corridor edge via a **spur** (perpendicular projection). If a place has a `puerta` field, the door point is projected instead of the room centroid.
4. Connecting floors through vertical nodes (elevator/stairs) from `grafo.verticales`

`calcularRuta` runs A* over this graph. `modoAccesible: true` drops all edges with `accesible: false` (stairs).

The graph is constructed once per `modoAccesible` change via `useMemo` in `App.js`.

### Search

`src/lib/search.js` — Fuse.js search with alias generation. `agregarAliasBusqueda` enriches each place with `aliasBusqueda[]` (normalized code variants like `s01`, `s-01`, `s 01`) before indexing. The Fuse instance is created once outside the component and never recreated.

### Floor plans

PNG (or SVG) in `public/planos/`, referenced via the `plano` field on each floor in `campus.json`. Floor metadata for Python scripts is centralized in `scripts/planos_registry.py`.

### Spur calibration (door coords)

When a room's straight-line spur to the corridor crosses a wall, add a `puerta: { x, y }` field to the place in `campus.json`. Optionally include `join: "nodeA-nodeB"` to pin the spur to a specific corridor segment. `sugerir_puertas.py` automates this from the PNG; edit visually in `EditorCampus` tab Puertas.

### Dev tools

- **`EditorCampus`** (`#/editar/:piso`) — unified campus editor: tabs Grafo / Lugares / Puertas / Validación. Uses `usePanZoom.js` + `PlanoEditorCanvas.js`.
- **Aliases**: `#/anotar/:piso` → tab Grafo; `#/calibrar/:piso` → tab Lugares (deprecated, same component).
- **Legacy files**: `GraphEditor.js`, `CalibradorLugares.js` — superseded by `EditorCampus.js`.

See [ROADMAP.md](ROADMAP.md) for the full editing workflow.

### LocalStorage keys

- `aulado-favoritos` — Set of favorite place IDs
- `aulado-recientes` — Recent place IDs
- `aulado-paradas` — Itinerary stop IDs
- `aulado-modo-accesible` — `'1'` when accessible mode is on

### CI

Two jobs: `test` (pnpm test + pnpm build) and `verify-grafo` (Python `verificar_grafo.py` — fails if any edge in `grafo.json` crosses a wall pixel in the PNG).
