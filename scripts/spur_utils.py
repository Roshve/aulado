"""
spur_utils.py — utilidades compartidas para spurs aula→corredor y detección de paredes.

Usado por verificar_grafo.py y sugerir_puertas.py.
"""
from __future__ import annotations

import math

import numpy as np

# Dimensiones nominales de los PNGs (pdftocairo @ 3000px ancho; routing.js usa el mismo ASPECT)
W_PX, H_PX = 3000, 2122
ASPECT = H_PX / W_PX


def usar_dimensiones_plano(ancho: int, alto: int) -> None:
    """Ajusta W_PX/H_PX/ASPECT al tamaño real del PNG del piso (p. ej. segundo piso)."""
    global W_PX, H_PX, ASPECT
    W_PX, H_PX = ancho, alto
    ASPECT = alto / ancho

BRILLO_PARED = 140
N_MUESTRAS = 300
TRIM = 0.08
RUN_PARED_MIN = 6
MAX_SPUR_PCT = 12
T_ENDPOINT = 0.05


def es_rojo(R, G, B):
    return (R > 160) & ((R.astype(np.int16) - G) > 80) & ((R.astype(np.int16) - B) > 80)


def pct_a_px(x_pct, y_pct, w=W_PX, h=H_PX):
    return x_pct * w / 100.0, y_pct * h / 100.0


def dist_pct(a, b):
    return math.hypot(b[0] - a[0], (b[1] - a[1]) * ASPECT)


def proyectar_en_segmento(p, a, b):
    dx = b[0] - a[0]
    dy = (b[1] - a[1]) * ASPECT
    len2 = dx * dx + dy * dy
    if len2 == 0:
        return 0.0, a[0], a[1], dist_pct(p, a)
    t = ((p[0] - a[0]) * dx + ((p[1] - a[1]) * ASPECT) * dy) / len2
    t = max(0.0, min(1.0, t))
    px = a[0] + t * (b[0] - a[0])
    py = a[1] + t * (b[1] - a[1])
    return t, px, py, dist_pct(p, (px, py))


def muestras_segmento(ax, ay, bx, by, n=N_MUESTRAS):
    ts = np.linspace(0, 1, n)
    xs = (ax + ts * (bx - ax)).astype(np.int32)
    ys = (ay + ts * (by - ay)).astype(np.int32)
    xs = np.clip(xs, 0, W_PX - 1)
    ys = np.clip(ys, 0, H_PX - 1)
    return xs, ys


def max_run_pared(pared_mask_1d):
    if not np.any(pared_mask_1d):
        return 0
    padded = np.concatenate([[False], pared_mask_1d, [False]])
    diffs = np.diff(padded.astype(np.int8))
    starts = np.where(diffs == 1)[0]
    ends = np.where(diffs == -1)[0]
    if len(starts) == 0:
        return 0
    return int((ends - starts).max())


def mascara_paredes(arr):
    R = arr[:, :, 0].astype(np.int16)
    G = arr[:, :, 1].astype(np.int16)
    B = arr[:, :, 2].astype(np.int16)
    brillo = (R + G + B) // 3
    return (brillo < BRILLO_PARED) & ~es_rojo(R, G, B)


def verificar_arista(ax_pct, ay_pct, bx_pct, by_pct, pared_mask):
    ax, ay = pct_a_px(ax_pct, ay_pct)
    bx, by = pct_a_px(bx_pct, by_pct)
    xs, ys = muestras_segmento(ax, ay, bx, by)
    trim_n = max(1, int(len(xs) * TRIM))
    xs_int = xs[trim_n:-trim_n]
    ys_int = ys[trim_n:-trim_n]
    if len(xs_int) == 0:
        return False, 0
    run = max_run_pared(pared_mask[ys_int, xs_int])
    return run >= RUN_PARED_MIN, run


def wall_run(ax_pct, ay_pct, bx_pct, by_pct, pared_mask):
    """Corrida máxima de pared en el segmento (px)."""
    return verificar_arista(ax_pct, ay_pct, bx_pct, by_pct, pared_mask)[1]


def _join_desde_proyeccion(t, jx, jy, pa, pb):
    if t <= T_ENDPOINT:
        return pa
    if t >= 1 - T_ENDPOINT:
        return pb
    return (jx, jy)


def elegir_spur(p_lugar, aristas_piso, pared_mask, puerta=None):
    anchor = puerta if puerta else p_lugar
    candidatos = []

    def _evaluar(pa, pb, aid, bid):
        t, jx, jy, d = proyectar_en_segmento(anchor, pa, pb)
        join = _join_desde_proyeccion(t, jx, jy, pa, pb)
        if puerta:
            wr_in = wall_run(p_lugar[0], p_lugar[1], puerta[0], puerta[1], pared_mask)
            wr_out = wall_run(puerta[0], puerta[1], join[0], join[1], pared_mask)
            wr = max(wr_in, wr_out)
        else:
            wr = wall_run(p_lugar[0], p_lugar[1], join[0], join[1], pared_mask)
        return wr, d, t, jx, jy, pa, pb, aid, bid, join

    for pa, pb, aid, bid in aristas_piso:
        t, jx, jy, d = proyectar_en_segmento(anchor, pa, pb)
        if d > MAX_SPUR_PCT:
            continue
        candidatos.append(_evaluar(pa, pb, aid, bid))

    if not candidatos:
        for pa, pb, aid, bid in aristas_piso:
            candidatos.append(_evaluar(pa, pb, aid, bid))

    if not candidatos:
        return None

    wr, d, t, jx, jy, pa, pb, aid, bid, join = min(candidatos, key=lambda c: (c[0], c[1]))
    return {
        'wr': wr,
        'dist': d,
        't': t,
        'jx': jx,
        'jy': jy,
        'seg': (pa, pb, aid, bid),
        'join': join,
        'cruza': wr >= RUN_PARED_MIN,
    }


def canonical_join(aid, bid):
    a, b = sorted([aid, bid])
    return f'{a}-{b}'


def elegir_proyeccion_js(anchor, aristas_piso, max_spur_pct=MAX_SPUR_PCT, join_hint=None):
    """Réplica de routing.js elegirProyeccionSpur (solo distancia, sin paredes)."""
    pool = aristas_piso
    if join_hint:
        filtrados = [
            (pa, pb, aid, bid) for pa, pb, aid, bid in aristas_piso
            if canonical_join(aid, bid) == join_hint
        ]
        if filtrados:
            pool = filtrados

    candidatos = []
    for pa, pb, aid, bid in pool:
        t, jx, jy, d = proyectar_en_segmento(anchor, pa, pb)
        candidatos.append((d, t, jx, jy, pa, pb, aid, bid))

    if not candidatos:
        return None

    within = [c for c in candidatos if c[0] <= max_spur_pct]
    pool_c = within if within else candidatos
    d, t, jx, jy, pa, pb, aid, bid = min(pool_c, key=lambda c: c[0])
    return {
        'dist': d,
        't': t,
        'jx': jx,
        'jy': jy,
        'seg': (pa, pb, aid, bid),
        'join_id': canonical_join(aid, bid),
    }


def aristas_piso_desde_grafo(piso_datos, get_xy):
    """Lista de (pa, pb, a_id, b_id) para un piso."""
    segs = []
    for a_id, b_id in piso_datos['aristas']:
        pa = get_xy(a_id)
        pb = get_xy(b_id)
        if pa and pb:
            segs.append((pa, pb, a_id, b_id))
    return segs
