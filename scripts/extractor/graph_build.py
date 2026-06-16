"""Construcción de grafo desde skeleton con NetworkX."""
from __future__ import annotations

import math
from collections import defaultdict

import networkx as nx
import numpy as np
from numpy.typing import NDArray

from .models import Edge, Node

ASPECT = 2122 / 3000  # alto/ancho nominal del plano (pdftocairo @ 3000px)


def px_a_pct(x: float, y: float, w: int, h: int) -> tuple[float, float]:
    return round(x / w * 100, 2), round(y / h * 100, 2)


def dist_pct(ax: float, ay: float, bx: float, by: float) -> float:
    return math.hypot(bx - ax, (by - ay) * ASPECT)


def _vecinos_8(r: int, c: int, h: int, w: int) -> list[tuple[int, int]]:
    out = []
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w:
                out.append((nr, nc))
    return out


def _keypoints(skel: NDArray[np.bool_]) -> list[tuple[int, int]]:
    """Endpoints (grado 1) e intersecciones (grado >= 3) en el skeleton."""
    h, w = skel.shape
    pts: list[tuple[int, int]] = []
    for r in range(h):
        for c in range(w):
            if not skel[r, c]:
                continue
            deg = sum(1 for nr, nc in _vecinos_8(r, c, h, w) if skel[nr, nc])
            if deg == 1 or deg >= 3:
                pts.append((r, c))
    return pts


def _trace_segment(
    skel: NDArray[np.bool_],
    start: tuple[int, int],
    prev: tuple[int, int] | None,
    keypoint_set: set[tuple[int, int]],
) -> tuple[tuple[int, int], list[tuple[int, int]]]:
    """Camina por el skeleton hasta el siguiente keypoint."""
    path = [start]
    cur = start
    back = prev
    while True:
        nbrs = [p for p in _vecinos_8(cur[0], cur[1], skel.shape[0], skel.shape[1]) if skel[p[0], p[1]] and p != back]
        if not nbrs:
            return cur, path
        nxt = nbrs[0]
        if len(nbrs) > 1 or nxt in keypoint_set:
            return nxt, path + [nxt]
        path.append(nxt)
        back, cur = cur, nxt


def _simplify_colinear(nodes: list[Node], edges: list[Edge], angle_tol_deg: float = 12.0) -> tuple[list[Node], list[Edge]]:
    """Elimina nodos intermedios en tramos casi rectos (grado 2)."""
    adj: dict[str, set[str]] = defaultdict(set)
    pos = {n.id: (n.x, n.y) for n in nodes}
    for e in edges:
        adj[e.a].add(e.b)
        adj[e.b].add(e.a)

    removed: set[str] = set()
    changed = True
    while changed:
        changed = False
        for nid in list(pos.keys()):
            if nid in removed or len(adj[nid]) != 2:
                continue
            nbrs = list(adj[nid])
            a, b = nbrs[0], nbrs[1]
            ax, ay = pos[a]
            bx, by = pos[b]
            nx, ny = pos[nid]
            v1 = (nx - ax, (ny - ay) * ASPECT)
            v2 = (bx - nx, (by - ny) * ASPECT)
            len1 = math.hypot(*v1)
            len2 = math.hypot(*v2)
            if len1 < 1e-6 or len2 < 1e-6:
                continue
            cos_a = (v1[0] * v2[0] + v1[1] * v2[1]) / (len1 * len2)
            cos_a = max(-1.0, min(1.0, cos_a))
            angle = math.degrees(math.acos(cos_a))
            if angle > angle_tol_deg:
                continue
            adj[a].remove(nid)
            adj[b].remove(nid)
            adj[a].add(b)
            adj[b].add(a)
            removed.add(nid)
            changed = True

    kept = [n for n in nodes if n.id not in removed]
    edge_set: set[tuple[str, str]] = set()
    for a, nbrs in adj.items():
        if a in removed:
            continue
        for b in nbrs:
            if b in removed or a >= b:
                continue
            edge_set.add((a, b))

    new_edges = []
    for a, b in edge_set:
        ax, ay = pos[a]
        bx, by = pos[b]
        new_edges.append(Edge(a=a, b=b, peso=dist_pct(ax, ay, bx, by)))
    return kept, new_edges


def build_graph_from_skeleton(
    skel: NDArray[np.bool_],
    w: int,
    h: int,
    prefix: str = 'auto',
    merge_dist_pct: float = 2.5,
) -> tuple[list[Node], list[Edge], float]:
    """
    Detecta keypoints, traza segmentos y exporta nodos/aristas en %.
    Devuelve confidence heurística (0-1).
    """
    keypoints = _keypoints(skel)
    if len(keypoints) < 2:
        return [], [], 0.0

    # Fusionar keypoints muy cercanos
    merged: list[tuple[int, int]] = []
    used = [False] * len(keypoints)
    merge_px = merge_dist_pct * w / 100
    for i, pi in enumerate(keypoints):
        if used[i]:
            continue
        group = [pi]
        used[i] = True
        for j, pj in enumerate(keypoints):
            if used[j]:
                continue
            if math.hypot(pi[1] - pj[1], (pi[0] - pj[0]) * ASPECT * w / h) < merge_px:
                group.append(pj)
                used[j] = True
        cr = int(sum(p[0] for p in group) / len(group))
        cc = int(sum(p[1] for p in group) / len(group))
        merged.append((cr, cc))

    kp_map: dict[tuple[int, int], str] = {}
    nodes: list[Node] = []
    for idx, (r, c) in enumerate(merged):
        nid = f'{prefix}-n{idx + 1}'
        x, y = px_a_pct(c, r, w, h)
        kp_map[(r, c)] = nid
        nodes.append(Node(id=nid, x=x, y=y, tipo='interseccion'))

    key_set = set(merged)
    G = nx.Graph()
    for n in nodes:
        G.add_node(n.id)

    visited_edges: set[tuple[tuple[int, int], tuple[int, int]]] = set()
    for kp in merged:
        for nbr in _vecinos_8(kp[0], kp[1], h, w):
            if not skel[nbr[0], nbr[1]]:
                continue
            edge_key = tuple(sorted([kp, nbr]))
            if edge_key in visited_edges:
                continue
            end, _path = _trace_segment(skel, nbr, kp, key_set)
            visited_edges.add(edge_key)
            if end not in kp_map:
                continue
            a, b = kp_map[kp], kp_map[end]
            if a == b:
                continue
            ax, ay = next(n.x for n in nodes if n.id == a), next(n.y for n in nodes if n.id == a)
            bx, by = next(n.x for n in nodes if n.id == b), next(n.y for n in nodes if n.id == b)
            G.add_edge(a, b, weight=dist_pct(ax, ay, bx, by))

    edges = [Edge(a=u, b=v, peso=G.edges[u, v]['weight']) for u, v in G.edges]
    nodes, edges = _simplify_colinear(nodes, edges)

    # Confidence: más nodos en pasillos largos → mejor; penalizar pocos nodos
    n_kp = len(nodes)
    confidence = min(1.0, max(0.2, n_kp / 12))
    return nodes, edges, confidence
