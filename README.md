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

### Grafo de navegación

El grafo topológico (`src/data/grafo.json`) es la **fuente de verdad** para rutas. El PNG solo sirve de fondo visual.

- **Waypoints** por piso: nodos de corredor + aristas
- **Verticales**: ascensor (`accesible: true`) y escalera (`accesible: false`)
- **Spurs**: las aulas de `campus.json` se enganchan automáticamente al corredor más cercano en runtime

En la vista de ruta podés activar **Ruta accesible** para excluir escaleras.

## Scripts offline (Python)

Dependencias:

```bash
pip install -r scripts/requirements.txt
```

### Extraer borrador de grafo desde PNG

```bash
python3 -m scripts.extractor --piso -1   # subsuelo
python3 -m scripts.extractor --piso 0    # planta baja
```

Genera `scripts/preview/draft-<slug>.json` y un overlay PNG. Flujo recomendado:

1. Extraer borrador automático
2. Revisar overlay en `scripts/preview/`
3. Importar en el editor: `#/editar/0` → tab **Grafo** → **Importar borrador**
4. Corregir nodos/aristas y lugares → **Exportar** o **Copiar JSON** → pegar en `grafo.json` / `campus.json`
5. Validar: `python3 scripts/verificar_grafo.py` (falla si alguna arista cruza paredes)

### Editor de campus (browser)

Herramienta dev unificada en `#/editar/:piso` (alias: `#/anotar/:piso` → tab Grafo, `#/calibrar/:piso` → tab Lugares).

Tabs: **Grafo** · **Lugares** · **Puertas** · **Validación**

Ver [ROADMAP.md](ROADMAP.md) para el checklist completo de integración de planos nuevos.

### Puertas automáticas (spurs a aulas)

Cuando el spur azul del centro del aula al corredor atraviesa paredes, agregá un campo
`puerta: { x, y }` en `campus.json`. El script offline lo calcula desde el PNG:

```bash
# Preview (stdout + scripts/preview/puertas-subsuelo.json)
python3 scripts/sugerir_puertas.py --piso -1

# Escribir puertas con status ok (respeta puertas existentes)
python3 scripts/sugerir_puertas.py --piso -1 --write

# Regenerar overlay y comprobar spurs
python3 scripts/verificar_grafo.py --solo-piso -1
python3 scripts/verificar_grafo.py --solo-piso -1 --json   # reporte para tab Validación
```

Las puertas ya calibradas a mano (p. ej. S-15) no se sobrescriben salvo `--force`.
Aulas con `status: manual_review` en el preview requieren ajuste en tab **Puertas** del editor.

### Otros scripts

| Script | Uso |
|--------|-----|
| `scripts/planos_registry.py` | Metadatos de pisos derivados de `campus.json` (usado por otros scripts) |
| `scripts/sugerir_puertas.py` | Calcula `puerta` en campus.json para spurs que cruzan paredes |
| `scripts/spur_utils.py` | Utilidades compartidas (máscara de paredes, proyección, spurs) |
| `scripts/detectar_circulos.py` | Centroides de aulas (círculos rojos) |
| `scripts/actualizar_campus.py` | Sincroniza coords de campus.json desde PNG |
| `scripts/verificar_grafo.py` | Gate de calidad del grafo (también en CI) |

## Planos

PNG en `/public/planos/` (usados por la app y scripts offline de verificación).

Para reemplazar o agregar un plano:

1. Agregá la imagen en `/public/planos/` (PNG recomendado).
2. Actualizá el campo `plano` del piso en `campus.json`.
3. Calibrá coords en `#/editar/:piso` → tab Lugares, o con `actualizar_campus.py`.

## Licencia

MIT — ver [LICENSE](LICENSE).
