"""CLI del extractor de grafos."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from scripts.planos_registry import piso_por_numero, planos_dict, nombres_dict

from .export import export_draft
from .graph_build import build_graph_from_skeleton
from .models import DraftFloorGraph
from .preprocess import load_image, occupancy_grid
from .rooms import detect_rooms, find_portals, match_campus_rooms
from .skeletonize import extract_skeleton
from .visualize import render_overlay

ROOT = Path(__file__).resolve().parents[2]


def _prefix(numero: int) -> str:
    if numero == -1:
        return 's'
    if numero == 0:
        return 'pb'
    if numero > 0:
        return f'p{numero}'
    return f'f{numero}'


def extract_floor(floor: int, img_path: Path | None = None) -> DraftFloorGraph:
    planos = planos_dict()
    img_path = img_path or planos.get(floor)
    if img_path is None or not img_path.exists():
        raise FileNotFoundError(f'Plano no encontrado para piso {floor}: {img_path}')

    rgb, w, h = load_image(str(img_path))
    walkable = occupancy_grid(rgb)
    skel = extract_skeleton(walkable)
    prefix = _prefix(floor)
    nodes, edges, confidence = build_graph_from_skeleton(skel, w, h, prefix=prefix)

    centroides, _, _ = detect_rooms(str(img_path))
    rooms = match_campus_rooms(centroides, floor)
    rooms = find_portals(rooms, nodes, edges)

    campus = json.loads((ROOT / 'src' / 'data' / 'campus.json').read_text())
    stairs, elevators = [], []
    for edificio in campus.get('edificios', []):
        for piso in edificio.get('pisos', []):
            if int(piso['numero']) != floor:
                continue
            for lugar in piso.get('lugares', []):
                lid = lugar['id']
                nombre = lugar.get('nombre', '').lower()
                if 'ascensor' in nombre or 'ascensor' in lid:
                    elevators.append(lid)
                elif 'escalera' in nombre or 'escalera' in lid:
                    stairs.append(lid)

    return DraftFloorGraph(
        floor=floor,
        source_image=str(img_path.relative_to(ROOT)),
        width_px=w,
        height_px=h,
        nodes=nodes,
        edges=edges,
        rooms=rooms,
        stairs=stairs,
        elevators=elevators,
        confidence=confidence,
    )


def main(argv: list[str] | None = None) -> int:
    nombres = nombres_dict()
    pisos_validos = list(nombres.keys())

    parser = argparse.ArgumentParser(description='Extrae grafo navegable desde PNG de un piso')
    parser.add_argument('--piso', type=int, required=True,
                        help=f'Número de piso ({", ".join(str(p) for p in sorted(pisos_validos))})')
    parser.add_argument('--imagen', type=str, default=None, help='Ruta alternativa al PNG')
    parser.add_argument('--salida', type=str, default=None,
                        help='Ruta del JSON de borrador (default: scripts/preview/draft-<slug>.json)')
    parser.add_argument('--overlay', type=str, default=None,
                        help='Ruta del PNG overlay (default: scripts/preview/draft-<slug>.png)')
    args = parser.parse_args(argv)

    if args.piso not in pisos_validos:
        print(f'Piso {args.piso} no registrado en campus.json. Pisos válidos: {pisos_validos}', file=sys.stderr)
        return 2

    preview = ROOT / 'scripts' / 'preview'
    nombre = nombres[args.piso]
    out_json = Path(args.salida) if args.salida else preview / f'draft-{nombre}.json'
    out_png = Path(args.overlay) if args.overlay else preview / f'draft-{nombre}.png'
    img_path = Path(args.imagen) if args.imagen else None

    draft = extract_floor(args.piso, img_path)
    export_draft(draft, out_json)
    planos = planos_dict()
    render_overlay(draft, str(img_path or planos[args.piso]), out_png)

    info = piso_por_numero(args.piso)
    print(f'Piso {args.piso} ({info["etiqueta"] if info else nombre}): '
          f'{len(draft.nodes)} nodos, {len(draft.edges)} aristas, '
          f'{len(draft.rooms)} habitaciones (confidence={draft.confidence:.2f})')
    print(f'  JSON:    {out_json.relative_to(ROOT)}')
    print(f'  Overlay: {out_png.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
