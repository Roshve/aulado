#!/usr/bin/env python3
"""
sugerir_puertas.py — calcula coordenadas puerta en campus.json para spurs que cruzan paredes.

Uso:
  python3 scripts/sugerir_puertas.py --piso -1
  python3 scripts/sugerir_puertas.py --piso -1 --write
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from spur_utils import (
    usar_dimensiones_plano,
    RUN_PARED_MIN,
    MAX_SPUR_PCT,
    T_ENDPOINT,
    canonical_join,
    elegir_proyeccion_js,
    elegir_spur,
    aristas_piso_desde_grafo,
    mascara_paredes,
    proyectar_en_segmento,
    wall_run,
)

from planos_registry import planos_dict, nombres_dict, numeros_piso

RAIZ = Path(__file__).parent.parent
GRAFO_PATH = RAIZ / 'src/data/grafo.json'
CAMPUS_PATH = RAIZ / 'src/data/campus.json'
PREVIEW_DIR = RAIZ / 'scripts/preview'

N_STEPS = 30
OFFSETS = (0, 0.3, -0.3, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0)


def cargar_datos():
    grafo = json.loads(GRAFO_PATH.read_text())
    campus = json.loads(CAMPUS_PATH.read_text())
    coords = {}
    for piso_str, piso_datos in grafo['pisos'].items():
        p = int(piso_str)
        for n in piso_datos['nodos']:
            coords[n['id']] = (n['x'], n['y'], p)
    for edificio in campus['edificios']:
        for piso in edificio['pisos']:
            p = int(piso['numero'])
            for lugar in piso['lugares']:
                lid = lugar['id']
                if lid not in coords:
                    coords[lid] = (lugar['coord']['x'], lugar['coord']['y'], p)
    return grafo, campus, coords


def ids_en_aristas(piso_datos):
    ids = set()
    for a, b in piso_datos['aristas']:
        ids.add(a)
        ids.add(b)
    return ids


def candidatos_puerta(centro, join):
    cx, cy = centro
    jx, jy = join
    dx, dy = jx - cx, jy - cy
    len_m = math.hypot(dx, (dy) * (2122 / 3000))
    if len_m < 1e-6:
        return [(cx, cy)]
    px, py = -dy / len_m, dx / len_m
    puntos = []
    for i in range(N_STEPS + 1):
        t = i / N_STEPS
        bx, by = cx + t * dx, cy + t * dy
        for off in OFFSETS:
            puntos.append((bx + off * px, by + off * py))
    return puntos


def join_en_segmento(p_lugar, pa, pb):
    t, jx, jy, d = proyectar_en_segmento(p_lugar, pa, pb)
    if t <= T_ENDPOINT:
        return pa, d
    if t >= 1 - T_ENDPOINT:
        return pb, d
    return (jx, jy), d


def buscar_puerta_en_join(p_lugar, join, pa, pb, aid, bid, aristas_piso, pared_mask):
    if join is None:
        return None
    mejor = None
    for cand in candidatos_puerta(p_lugar, join):
        spur = elegir_spur(p_lugar, aristas_piso, pared_mask, puerta=cand)
        if spur is None:
            continue
        score = spur['wr']
        wr_in = wall_run(p_lugar[0], p_lugar[1], cand[0], cand[1], pared_mask)
        wr_out = wall_run(cand[0], cand[1], spur['join'][0], spur['join'][1], pared_mask)
        join_id = canonical_join(spur['seg'][2], spur['seg'][3])
        if mejor is None or score < mejor[0]:
            mejor = (score, wr_in, wr_out, cand, join_id, spur)
    return mejor


def sugerir_puerta(p_lugar, aristas_piso, pared_mask):
    spur_ini = elegir_spur(p_lugar, aristas_piso, pared_mask, puerta=None)
    if spur_ini is None:
        return {'status': 'skip', 'reason': 'sin segmentos de corredor'}

    wall_before = spur_ini['wr']
    if not spur_ini['cruza']:
        return {
            'status': 'ok_sin_puerta',
            'wall_before': wall_before,
            'wall_after': wall_before,
            'join': f"{canonical_join(spur_ini['seg'][2], spur_ini['seg'][3])}",
        }

    mejor = None
    for pa, pb, aid, bid in aristas_piso:
        join, dist = join_en_segmento(p_lugar, pa, pb)
        if dist > MAX_SPUR_PCT * 1.5:
            continue
        cand = buscar_puerta_en_join(p_lugar, join, pa, pb, aid, bid, aristas_piso, pared_mask)
        if cand is None:
            continue
        score, wr_in, wr_out, puerta, join_id, spur = cand
        if mejor is None or score < mejor[0] or (score == mejor[0] and spur['dist'] < mejor[5]['dist']):
            mejor = (score, wr_in, wr_out, puerta, join_id, spur)

    if mejor is None:
        pa, pb, aid, bid = spur_ini['seg']
        join = spur_ini['join']
        cand = buscar_puerta_en_join(p_lugar, join, pa, pb, aid, bid, aristas_piso, pared_mask)
        if cand:
            score, wr_in, wr_out, puerta, join_id, spur = cand
            mejor = (score, wr_in, wr_out, puerta, join_id, spur)

    assert mejor is not None
    score, wr_in, wr_out, puerta, join_id, spur_fin = mejor

    join_id = canonical_join(spur_fin['seg'][2], spur_fin['seg'][3])
    js = elegir_proyeccion_js(puerta, aristas_piso)
    js_mismatch = js is not None and js['join_id'] != join_id

    result = {
        'status': 'ok' if score < RUN_PARED_MIN else 'manual_review',
        'puerta': {'x': round(puerta[0], 1), 'y': round(puerta[1], 1), 'join': join_id},
        'join': join_id,
        'wall_before': wall_before,
        'wall_after': score,
        'wr_in': wr_in,
        'wr_out': wr_out,
        'verified_wr': spur_fin['wr'],
    }
    if js_mismatch:
        result['js_join'] = js['join_id']
        result['needs_join_hint'] = True
    return result


def procesar_piso(piso, grafo, campus, coords, pared_mask, force=False):
    piso_str = str(piso)
    piso_datos = grafo['pisos'].get(piso_str)
    if not piso_datos:
        return []

    nodos_piso = {n['id']: (n['x'], n['y']) for n in piso_datos['nodos']}

    def get_xy(nid):
        if nid in nodos_piso:
            return nodos_piso[nid]
        if nid in coords:
            cx, cy, cp = coords[nid]
            if cp == piso:
                return (cx, cy)
        return None

    aristas = aristas_piso_desde_grafo(piso_datos, get_xy)
    en_aristas = ids_en_aristas(piso_datos)
    resultados = []

    for edificio in campus['edificios']:
        for p_data in edificio['pisos']:
            if int(p_data['numero']) != piso:
                continue
            for lugar in p_data['lugares']:
                if lugar.get('tipo') != 'aula':
                    continue
                lid = lugar['id']
                if lid in en_aristas:
                    continue
                if 'puerta' in lugar and not force:
                    resultados.append({
                        'id': lid,
                        'status': 'skipped_existing',
                        'puerta': lugar['puerta'],
                    })
                    continue

                p_lugar = (lugar['coord']['x'], lugar['coord']['y'])
                sug = sugerir_puerta(p_lugar, aristas, pared_mask)
                sug['id'] = lid
                resultados.append(sug)

    return resultados


def escribir_campus(campus, resultados, piso):
    cambios = 0
    for r in resultados:
        if r['status'] not in ('ok',):
            continue
        lid = r['id']
        for edificio in campus['edificios']:
            for p_data in edificio['pisos']:
                if int(p_data['numero']) != piso:
                    continue
                for lugar in p_data['lugares']:
                    if lugar['id'] == lid:
                        lugar['puerta'] = r['puerta']
                        cambios += 1
    return cambios


def main():
    nombres = nombres_dict()
    pisos_validos = numeros_piso()

    parser = argparse.ArgumentParser(description='Sugerir puertas para spurs que cruzan paredes')
    parser.add_argument('--piso', type=int, required=True,
                        help=f'Número de piso ({", ".join(str(p) for p in sorted(pisos_validos))})')
    parser.add_argument('--write', action='store_true', help='Escribir puertas ok en campus.json')
    parser.add_argument('--force', action='store_true', help='Recalcular aunque ya exista puerta')
    args = parser.parse_args()

    if args.piso not in pisos_validos:
        print(f'Piso {args.piso} no registrado en campus.json', file=sys.stderr)
        sys.exit(2)

    PLANOS = planos_dict()
    NOMBRE_PISO = nombres

    grafo, campus, coords = cargar_datos()
    plano = PLANOS.get(args.piso)
    if not plano or not plano.exists():
        print(f'[ERROR] Plano no encontrado: {plano}', file=sys.stderr)
        sys.exit(1)

    img = Image.open(plano).convert('RGB')
    usar_dimensiones_plano(*img.size)
    arr = np.array(img, dtype=np.int16)
    pared_mask = mascara_paredes(arr)
    resultados = procesar_piso(args.piso, grafo, campus, coords, pared_mask, force=args.force)

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    out_json = PREVIEW_DIR / f'puertas-{NOMBRE_PISO[args.piso]}.json'
    out_json.write_text(json.dumps(resultados, indent=2, ensure_ascii=False) + '\n')

    ok = manual = skip = sin = exist = 0
    print(f'Piso {args.piso} ({NOMBRE_PISO[args.piso]})\n')
    for r in resultados:
        lid = r['id']
        st = r['status']
        if st == 'ok':
            ok += 1
            p = r['puerta']
            hint = ' [join hint]' if r.get('needs_join_hint') else ''
            print(f"  ✓ {lid}: puerta ({p['x']}, {p['y']}) join {r['join']} "
                  f"wall {r['wall_before']}→{r['wall_after']} px{hint}")
            if r.get('needs_join_hint'):
                print(f"      JS sin hint elegiría {r.get('js_join')} — se guarda join en campus.json")
        elif st == 'ok_sin_puerta':
            sin += 1
            print(f"  · {lid}: spur ok sin puerta (wall={r['wall_before']} px)")
        elif st == 'manual_review':
            manual += 1
            p = r.get('puerta', {})
            print(f"  ✗ {lid}: revisión manual join {r.get('join')} "
                  f"wall {r.get('wall_before')}→{r.get('wall_after')} px "
                  f"candidato ({p.get('x')}, {p.get('y')})")
        elif st == 'skipped_existing':
            exist += 1
            p = r['puerta']
            print(f"  ⊘ {lid}: puerta existente ({p['x']}, {p['y']}) — omitido")
        else:
            skip += 1
            print(f"  ? {lid}: {r.get('reason', st)}")

    print(f"\nResumen: {ok} puertas ok, {sin} sin puerta necesaria, "
          f"{exist} omitidas, {manual} revisión manual, {skip} skip")
    print(f'Preview: {out_json.relative_to(RAIZ)}')

    if args.write:
        n = escribir_campus(campus, resultados, args.piso)
        CAMPUS_PATH.write_text(json.dumps(campus, indent=2, ensure_ascii=False) + '\n')
        print(f'Escritas {n} puertas en {CAMPUS_PATH.relative_to(RAIZ)}')

    sys.exit(1 if manual > 0 else 0)


if __name__ == '__main__':
    main()
