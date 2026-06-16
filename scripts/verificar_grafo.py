#!/usr/bin/env python3
"""
verificar_grafo.py — verifica que ninguna arista de grafo.json cruce paredes
y genera overlays visuales sobre los planos PNG.

Uso:
  python3 scripts/verificar_grafo.py [--solo-piso -1|0|1|2]

Salida:
  scripts/preview/grafo-<piso>.png  — overlay por piso
  stdout: reporte de cruces por piso
  exit code: 0 = sin cruces, 1 = hay cruces
"""
import sys
import json
import argparse
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

from spur_utils import (
    usar_dimensiones_plano,
    RUN_PARED_MIN,
    T_ENDPOINT,
    pct_a_px,
    elegir_spur,
    mascara_paredes,
    verificar_arista,
    aristas_piso_desde_grafo,
)

# Colores overlay
COLOR_ARISTA_OK = (0, 210, 60, 210)
COLOR_ARISTA_BAD = (255, 30, 30, 230)
COLOR_SPUR = (0, 150, 255, 120)
COLOR_SPUR_JOIN = (0, 150, 255, 180)
COLOR_NODO = (255, 220, 0, 230)
COLOR_NODO_BAD = (255, 30, 30, 255)

GROSOR_ARISTA = 3
GROSOR_SPUR = 2
GROSOR_RUTA = 5
RADIO_NODO = 5

from planos_registry import planos_dict, nombres_dict, numeros_piso

RAIZ = Path(__file__).parent.parent
GRAFO_PATH = RAIZ / 'src/data/grafo.json'
CAMPUS_PATH = RAIZ / 'src/data/campus.json'
RUTAS_PATH = RAIZ / 'scripts/preview/rutas.json'
PREVIEW_DIR = RAIZ / 'scripts/preview'

def _planos():
    return planos_dict()

def _nombres():
    return nombres_dict()


def cargar_coords():
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
                cx = lugar['coord']['x']
                cy = lugar['coord']['y']
                if lid not in coords:
                    coords[lid] = (cx, cy, p)
    return grafo, campus, coords


def cargar_rutas():
    if RUTAS_PATH.exists():
        return json.loads(RUTAS_PATH.read_text())
    return []


def overlay_piso(piso, grafo, coords, pared_mask, rutas_json, plano_path):
    piso_str = str(piso)
    piso_datos = grafo['pisos'].get(piso_str)
    if not piso_datos:
        return None, [], []

    plano = Image.open(plano_path).convert('RGBA')
    overlay = Image.new('RGBA', plano.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    nodos_piso = {n['id']: (n['x'], n['y']) for n in piso_datos['nodos']}

    def get_xy(nid):
        if nid in nodos_piso:
            return nodos_piso[nid]
        if nid in coords:
            cx, cy, cp = coords[nid]
            if cp == piso:
                return (cx, cy)
        return None

    campus_data = json.loads(CAMPUS_PATH.read_text())
    aristas_piso = aristas_piso_desde_grafo(piso_datos, get_xy)

    arista_ids = set()
    for a, b in piso_datos['aristas']:
        arista_ids.add(a)
        arista_ids.add(b)

    cruces_spur = []

    for edificio in campus_data['edificios']:
        for p_data in edificio['pisos']:
            if int(p_data['numero']) != piso:
                continue
            for lugar in p_data['lugares']:
                lid = lugar['id']
                if lid in arista_ids:
                    continue
                lx, ly = lugar['coord']['x'], lugar['coord']['y']
                p_lugar = (lx, ly)
                puerta = None
                if 'puerta' in lugar:
                    puerta = (lugar['puerta']['x'], lugar['puerta']['y'])

                if not aristas_piso:
                    continue

                spur = elegir_spur(p_lugar, aristas_piso, pared_mask, puerta=puerta)
                if spur is None:
                    continue

                mejor_t = spur['t']
                mejor_px, mejor_py = spur['jx'], spur['jy']
                mejor_seg = spur['seg']
                if spur['cruza']:
                    cruces_spur.append((lid, spur['wr']))

                lx_px, ly_px = pct_a_px(lx, ly)
                if puerta:
                    px_px, py_px = pct_a_px(puerta[0], puerta[1])
                    draw.line([(lx_px, ly_px), (px_px, py_px)],
                              fill=COLOR_SPUR[:3], width=GROSOR_SPUR)
                    lx_px, ly_px = px_px, py_px

                spur_color = COLOR_ARISTA_BAD[:3] if spur['cruza'] else COLOR_SPUR[:3]
                if mejor_t <= T_ENDPOINT:
                    ex_px, ey_px = pct_a_px(mejor_seg[0][0], mejor_seg[0][1])
                elif mejor_t >= 1 - T_ENDPOINT:
                    ex_px, ey_px = pct_a_px(mejor_seg[1][0], mejor_seg[1][1])
                else:
                    ex_px, ey_px = pct_a_px(mejor_px, mejor_py)
                    draw.ellipse(
                        [(ex_px - 3, ey_px - 3), (ex_px + 3, ey_px + 3)],
                        fill=COLOR_SPUR_JOIN[:3],
                    )
                draw.line([(lx_px, ly_px), (ex_px, ey_px)],
                          fill=spur_color, width=GROSOR_SPUR)

    cruces = []
    nodos_malos = set()

    for a_id, b_id in piso_datos['aristas']:
        pa = get_xy(a_id)
        pb = get_xy(b_id)
        if pa is None or pb is None:
            continue

        cruza, run = verificar_arista(pa[0], pa[1], pb[0], pb[1], pared_mask)
        color = COLOR_ARISTA_BAD[:3] if cruza else COLOR_ARISTA_OK[:3]

        ax_px, ay_px = pct_a_px(pa[0], pa[1])
        bx_px, by_px = pct_a_px(pb[0], pb[1])
        draw.line([(ax_px, ay_px), (bx_px, by_px)], fill=color, width=GROSOR_ARISTA)

        if cruza:
            cruces.append((a_id, b_id, run))
            nodos_malos.add(a_id)
            nodos_malos.add(b_id)

    for n in piso_datos['nodos']:
        nx_px, ny_px = pct_a_px(n['x'], n['y'])
        color_nodo = COLOR_NODO_BAD[:3] if n['id'] in nodos_malos else COLOR_NODO[:3]
        r = RADIO_NODO
        draw.ellipse([(nx_px - r, ny_px - r), (nx_px + r, ny_px + r)], fill=color_nodo)
        draw.text((nx_px + r + 1, ny_px - 6), n['id'], fill=(0, 0, 0))

    for ruta in rutas_json:
        for seg in ruta.get('segmentos', []):
            if seg['piso'] != piso:
                continue
            puntos = seg['puntos']
            if len(puntos) < 2:
                continue
            color_r = tuple(ruta.get('color', [200, 0, 200]))
            pts_px = [pct_a_px(pt['x'], pt['y']) for pt in puntos]
            draw.line(pts_px, fill=color_r, width=GROSOR_RUTA)
            sx, sy = pts_px[0]
            ex, ey = pts_px[-1]
            draw.ellipse([(sx - 5, sy - 5), (sx + 5, sy + 5)], fill=color_r)
            draw.ellipse([(ex - 4, ey - 4), (ex + 4, ey + 4)], outline=color_r, width=2)

    resultado = Image.alpha_composite(plano, overlay).convert('RGB')
    return resultado, cruces, cruces_spur


def main():
    parser = argparse.ArgumentParser(description='Verificar grafo de pasillos')
    parser.add_argument('--solo-piso', type=int, default=None,
                        help='Renderizar solo este piso')
    parser.add_argument('--json', action='store_true',
                        help='Imprimir reporte JSON (para importar en EditorCampus)')
    args = parser.parse_args()

    PLANOS = _planos()
    NOMBRE_PISO = _nombres()

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    grafo, campus, coords = cargar_coords()
    rutas_json = cargar_rutas()

    pisos = list(map(int, grafo['pisos'].keys()))
    if args.solo_piso is not None:
        pisos = [args.solo_piso]

    total_aristas = 0
    total_cruces = 0
    hay_errores = False
    reporte = {'ok': True, 'totalCruces': 0, 'pisos': [], 'cruces': []}

    for piso in sorted(pisos):
        plano_path = PLANOS.get(piso)
        if not plano_path or not plano_path.exists():
            print(f"[WARN] No existe plano para piso {piso}: {plano_path}")
            continue

        img = Image.open(plano_path).convert('RGB')
        usar_dimensiones_plano(*img.size)
        arr = np.array(img, dtype=np.int16)
        pared_mask = mascara_paredes(arr)

        resultado, cruces, cruces_spur = overlay_piso(
            piso, grafo, coords, pared_mask, rutas_json, plano_path,
        )

        slug = NOMBRE_PISO.get(piso, f'piso-{piso}')
        out_path = PREVIEW_DIR / f'grafo-{slug}.png'
        if resultado:
            resultado.save(str(out_path))

        n_ar = len(grafo['pisos'][str(piso)]['aristas'])
        n_cr = len(cruces)
        n_spur = len(cruces_spur)
        total_aristas += n_ar
        total_cruces += n_cr

        piso_reporte = {
            'piso': piso,
            'slug': slug,
            'aristas': n_ar,
            'cruces': n_cr,
            'spursMalos': n_spur,
            'overlay': str(out_path.relative_to(RAIZ)) if resultado else None,
        }
        reporte['pisos'].append(piso_reporte)

        status = '✓' if n_cr == 0 else '✗'
        rutas_en_piso = sum(
            1 for r in rutas_json
            for s in r.get('segmentos', [])
            if s['piso'] == piso
        )
        print(f"\n{status} Piso {piso} ({slug})")
        print(f"  Aristas: {n_ar} totales, {n_cr} cruzan pared")
        print(f"  Spurs a aulas: {n_spur} cruzan pared (rojo en overlay)")
        print(f"  Rutas de muestra dibujadas: {rutas_en_piso}")
        if resultado:
            print(f"  Overlay: {out_path.relative_to(RAIZ)}")
        for a, b, run in cruces:
            print(f"  ✗ [{a}]─[{b}]  (corrida de pared: {run} px)")
            hay_errores = True
            reporte['cruces'].append({'piso': piso, 'arista': f'{a}-{b}', 'tipo': 'arista', 'run': run})
        for lid, run in cruces_spur:
            print(f"  ⚠ spur [{lid}] cruza pared ({run} px) — agregar puerta en campus.json")
            reporte['cruces'].append({'piso': piso, 'arista': lid, 'tipo': 'spur', 'run': run})

    reporte['totalCruces'] = total_cruces
    reporte['ok'] = not hay_errores

    print(f"\n{'─'*55}")
    print(f"Total aristas: {total_aristas}  |  Cruces de pared: {total_cruces}")
    if total_cruces == 0:
        print("✅ Grafo limpio: ninguna arista cruza paredes.")
    else:
        print(f"❌ {total_cruces} aristas cruzan paredes — revisar overlay.")

    if args.json:
        json_path = PREVIEW_DIR / 'reporte-grafo.json'
        json_path.write_text(json.dumps(reporte, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f"\nReporte JSON: {json_path.relative_to(RAIZ)}")

    sys.exit(1 if hay_errores else 0)


if __name__ == '__main__':
    main()
