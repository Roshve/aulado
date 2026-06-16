"""Detección de habitaciones (círculos rojos) y matching con campus.json."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from .models import Edge, Node, Room

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / 'scripts'


def _import_detectar():
    """Importa detectar_circulos desde scripts/ (módulo suelto)."""
    if str(SCRIPTS) not in sys.path:
        sys.path.insert(0, str(SCRIPTS))
    import detectar_circulos  # noqa: WPS433
    return detectar_circulos


def detect_rooms(img_path: str, min_px: int = 500) -> tuple[list[dict], int, int]:
    mod = _import_detectar()
    centroides, W, H = mod.detectar_rojos(img_path)
    return [c for c in centroides if c.get('pixels_rojos', 0) >= min_px], W, H


def match_campus_rooms(
    centroides: list[dict],
    floor: int,
    campus_path: Path | None = None,
) -> list[Room]:
    """Asigna cada círculo detectado al POI más cercano del piso en campus.json."""
    campus_path = campus_path or ROOT / 'src' / 'data' / 'campus.json'
    campus = json.loads(campus_path.read_text())

    lugares = []
    for edificio in campus.get('edificios', []):
        for piso in edificio.get('pisos', []):
            if int(piso['numero']) != floor:
                continue
            for lugar in piso.get('lugares', []):
                if lugar.get('tipo') == 'aula':
                    lugares.append(lugar)

    used: set[str] = set()
    rooms: list[Room] = []
    for i, c in enumerate(centroides):
        best_id = None
        best_d = float('inf')
        for lug in lugares:
            if lug['id'] in used:
                continue
            lx = lug['coord']['x']
            ly = lug['coord']['y']
            d = math.hypot(c['x'] - lx, (c['y'] - ly) * (2122 / 3000))
            if d < best_d:
                best_d = d
                best_id = lug['id']
        label = best_id or f'room-{i + 1}'
        if best_id:
            used.add(best_id)
        rooms.append(Room(id=label, x=c['x'], y=c['y'], label=label))
    return rooms


def find_portals(rooms: list[Room], nodes: list[Node], edges: list[Edge]) -> list[Room]:
    """Proyecta cada habitación sobre la arista más cercana (spur)."""
    from .graph_build import dist_pct, ASPECT  # noqa: WPS433

    node_map = {n.id: n for n in nodes}
    updated = []
    for room in rooms:
        p = (room.x, room.y)
        best_dist = float('inf')
        best_node = None
        for e in edges:
            a = node_map.get(e.a)
            b = node_map.get(e.b)
            if not a or not b:
                continue
            # proyección sobre segmento
            dx = b.x - a.x
            dy = (b.y - a.y) * ASPECT
            len2 = dx * dx + dy * dy
            if len2 == 0:
                continue
            t = max(0, min(1, ((p[0] - a.x) * dx + ((p[1] - a.y) * ASPECT) * dy) / len2))
            jx = a.x + t * (b.x - a.x)
            jy = a.y + t * (b.y - a.y)
            d = dist_pct(p[0], p[1], jx, jy)
            if d < best_dist:
                best_dist = d
                if t <= 0.05:
                    best_node = a.id
                elif t >= 0.95:
                    best_node = b.id
                else:
                    best_node = a.id if dist_pct(jx, jy, a.x, a.y) < dist_pct(jx, jy, b.x, b.y) else b.id
        updated.append(Room(
            id=room.id, x=room.x, y=room.y, label=room.label, portal_node=best_node,
        ))
    return updated
