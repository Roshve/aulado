"""Overlay visual del borrador sobre el plano PNG."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from .models import DraftFloorGraph, Node

COLOR_NODO = (255, 220, 0, 230)
COLOR_ARISTA = (0, 210, 60, 210)
COLOR_ROOM = (255, 60, 60, 180)
COLOR_PORTAL = (0, 150, 255, 200)


def pct_a_px(x_pct: float, y_pct: float, w: int, h: int) -> tuple[int, int]:
    return int(x_pct * w / 100), int(y_pct * h / 100)


def render_overlay(draft: DraftFloorGraph, plano_path: str, out_path: Path) -> None:
    plano = Image.open(plano_path).convert('RGBA')
    w, h = plano.size
    overlay = Image.new('RGBA', plano.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    node_map: dict[str, Node] = {n.id: n for n in draft.nodes}

    for e in draft.edges:
        na = node_map.get(e.a)
        nb = node_map.get(e.b)
        if not na or not nb:
            continue
        ax, ay = pct_a_px(na.x, na.y, w, h)
        bx, by = pct_a_px(nb.x, nb.y, w, h)
        draw.line([(ax, ay), (bx, by)], fill=COLOR_ARISTA[:3], width=3)

    for n in draft.nodes:
        nx, ny = pct_a_px(n.x, n.y, w, h)
        r = 5
        draw.ellipse([(nx - r, ny - r), (nx + r, ny + r)], fill=COLOR_NODO[:3])
        draw.text((nx + r + 2, ny - 6), n.id, fill=(0, 0, 0))

    for room in draft.rooms:
        rx, ry = pct_a_px(room.x, room.y, w, h)
        draw.ellipse([(rx - 4, ry - 4), (rx + 4, ry + 4)], fill=COLOR_ROOM[:3])
        if room.portal_node and room.portal_node in node_map:
            pn = node_map[room.portal_node]
            px, py = pct_a_px(pn.x, pn.y, w, h)
            draw.line([(rx, ry), (px, py)], fill=COLOR_PORTAL[:3], width=2)

    result = Image.alpha_composite(plano, overlay).convert('RGB')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(str(out_path))
