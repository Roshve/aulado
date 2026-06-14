# Aulado 🎓

PWA open source para navegación de campus universitario.

Ayuda a estudiantes nuevos a encontrar aulas, oficinas y espacios en el campus —sin app oficial.

## Estado del proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1 — Buscador + ficha | ✅ | Búsqueda difusa, ficha de destino |
| 2 — Plano interior  | ✅ | Visor de plano con marcador en % |
| 3 — GPS a la entrada | 🔜 | Botón "Cómo llegar" con link a Maps |
| 4 — PWA + offline   | 🔜 | Favoritos, instalable, offline |

## Stack

- **Build**: Vite
- **UI**: Preact + htm
- **Búsqueda**: Fuse.js
- **PWA**: vite-plugin-pwa (Workbox)
- **Plano exterior** (Fase 3): Leaflet + OpenStreetMap

## Desarrollo

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:5173](http://localhost:5173).

## Modelo de datos

Los datos del campus viven en `src/data/campus.json`. Para agregar edificios o lugares,
seguí la estructura existente. Las coordenadas del plano van en porcentaje (0–100) sobre
cada eje de la imagen del piso.

Ver el campo `plano` de cada piso para saber qué imagen cargar en `/public/planos/`.

## Planos

Los planos en `/public/planos/` son placeholders con grilla en % para ubicar coordenadas
mientras se modelan los planos reales. Para reemplazar un plano:

1. Agregá la imagen real en `/public/planos/` (cualquier formato: SVG, PNG, WebP).
2. Actualizá el campo `plano` del piso correspondiente en `campus.json`.
3. Medí las coordenadas de cada lugar en % sobre la nueva imagen y actualizá `coord.x` / `coord.y`.

## Licencia

MIT — ver [LICENSE](LICENSE).
