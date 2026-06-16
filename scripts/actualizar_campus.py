#!/usr/bin/env python3
"""
actualizar_campus.py — actualiza campus.json con coordenadas reales detectadas del PDF.

Flujo:
  1. Detecta círculos rojos en cada PNG de plano
  2. Filtra ruido (blobs chicos o fuera del rango esperado)
  3. Nearest-neighbor: asigna cada círculo detectado al aula más cercana del JSON
  4. Reescribe campus.json con las nuevas coordenadas y rutas de plano

Uso:
  python3 scripts/actualizar_campus.py
"""

import json
import math
import sys
import os
from pathlib import Path
import numpy as np
from PIL import Image

from planos_registry import planos_dict

ROOT = Path(__file__).parent.parent
JSON_IN  = ROOT / "src" / "data" / "campus.json"
JSON_OUT = ROOT / "src" / "data" / "campus.json"

def _planos():
    return planos_dict()

# Umbral mínimo de píxeles rojos según piso.
# Las imágenes son 3000×2122px (pdftocairo @ 600 DPI, reescalado para web).
# por lo que los círculos son ~25% del tamaño original:
#   Subsuelo:  ~16K px → ~4K px a 1500px
#   PB/1P/2P: ~4.5K px → ~1.1K px a 1500px
# El logo de Instagram (~3.7K px en PDF → ~930px a 1500px) se filtra con >1000.
MIN_PX = {
    -1: 1200,  # Subsuelo: círculos ~4K px; ruido ~940px → margen amplio
     0:  600,  # Planta Baja: círculos ~1.1K px; ruido <600px
     1:  600,
     2:  600,
}

# -----------------------------------------------------------------------
# Detección de círculos rojos
# -----------------------------------------------------------------------

def detectar_circulos(img_path, min_px=800, merge_thresh=2.0, scale_down=4):
    img = Image.open(img_path).convert("RGB")
    W, H = img.size
    arr = np.array(img, dtype=np.int16)

    R, G, B = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    mask = (R > 160) & ((R - G) > 80) & ((R - B) > 80)

    S = scale_down
    rows, cols = np.where(mask)
    if len(rows) == 0:
        return [], W, H

    cell_r = rows // S
    cell_c = cols // S
    grid_H = (H + S - 1) // S
    grid_W = (W + S - 1) // S
    density = np.zeros((grid_H, grid_W), dtype=np.int32)
    np.add.at(density, (cell_r, cell_c), 1)

    active = density >= 5
    labels  = np.zeros_like(active, dtype=np.int32)
    label_id = 0
    neighbors_4 = [(-1,0),(1,0),(0,-1),(0,1)]

    active_rows, active_cols = np.where(active)
    unlabeled = set(zip(active_rows.tolist(), active_cols.tolist()))

    while unlabeled:
        seed = next(iter(unlabeled))
        label_id += 1
        queue = [seed]
        while queue:
            r, c = queue.pop()
            if (r, c) not in unlabeled:
                continue
            unlabeled.discard((r, c))
            labels[r, c] = label_id
            for dr, dc in neighbors_4:
                nr, nc = r + dr, c + dc
                if (nr, nc) in unlabeled:
                    queue.append((nr, nc))

    pix_labels = labels[rows // S, cols // S]
    centroides = []
    for lid in range(1, label_id + 1):
        sel = pix_labels == lid
        if sel.sum() < 20:
            continue
        cy_px = float(rows[sel].mean())
        cx_px = float(cols[sel].mean())
        centroides.append({
            "x": round(cx_px / W * 100, 2),
            "y": round(cy_px / H * 100, 2),
            "pixels_rojos": int(sel.sum()),
        })

    # Merge blobs muy cercanos (fragmentos del mismo círculo)
    T = merge_thresh
    merged = True
    while merged:
        merged = False
        kept, used = [], set()
        for i, a in enumerate(centroides):
            if i in used:
                continue
            group = [a]
            for j, b in enumerate(centroides):
                if j <= i or j in used:
                    continue
                if abs(a["x"] - b["x"]) < T and abs(a["y"] - b["y"]) < T:
                    group.append(b)
                    used.add(j)
            if len(group) > 1:
                merged = True
            total_px = sum(g["pixels_rojos"] for g in group)
            cx = sum(g["x"] * g["pixels_rojos"] for g in group) / total_px
            cy = sum(g["y"] * g["pixels_rojos"] for g in group) / total_px
            kept.append({"x": round(cx, 2), "y": round(cy, 2), "pixels_rojos": total_px})
            used.add(i)
        centroides = kept

    # Filtrar ruido
    centroides = [c for c in centroides if c["pixels_rojos"] >= min_px]

    # Normalizar: si un blob tiene >1.6× la mediana de px, dividirlo en dos horizontalmente
    # (círculos adyacentes que quedaron pegados)
    if centroides:
        median_px = sorted(c["pixels_rojos"] for c in centroides)[len(centroides)//2]
        final = []
        for c in centroides:
            if c["pixels_rojos"] > 1.6 * median_px:
                # Dividir en dos (estimar posición de cada mitad ±2% en x)
                half_offset = 2.5
                final.append({"x": round(c["x"] - half_offset, 2), "y": c["y"], "pixels_rojos": c["pixels_rojos"]//2})
                final.append({"x": round(c["x"] + half_offset, 2), "y": c["y"], "pixels_rojos": c["pixels_rojos"]//2})
            else:
                final.append(c)
        centroides = final

    centroides.sort(key=lambda c: (round(c["y"]), round(c["x"])))
    return centroides, W, H


# -----------------------------------------------------------------------
# Matching: detectado → room más cercana del JSON
# -----------------------------------------------------------------------

def dist(a, b):
    return math.sqrt((a["x"] - b["x"])**2 + (a["y"] - b["y"])**2)


def asignar_coordenadas(lugares_aula, centroides):
    """
    Nearest-neighbor greedy: asigna cada centroide detectado al aula más cercana.
    Solo actualiza lugares de tipo 'aula' (que tienen círculo rojo).
    Los POIs (tipo != 'aula') mantienen sus coordenadas estimadas.
    """
    if not centroides or not lugares_aula:
        return

    # Usamos una copia para no modificar la lista durante iteración
    disponibles = list(centroides)
    asignados   = {}  # id_lugar → centroide

    # Greedy: ordenar pares (dist, lugar_idx, centroide_idx) y asignar en orden
    pares = []
    for li, lugar in enumerate(lugares_aula):
        for ci, c in enumerate(disponibles):
            pares.append((dist(lugar["coord"], c), li, ci))

    pares.sort()
    usados_l, usados_c = set(), set()
    for d, li, ci in pares:
        if li in usados_l or ci in usados_c:
            continue
        asignados[li] = ci
        usados_l.add(li)
        usados_c.add(ci)

    for li, ci in asignados.items():
        c = disponibles[ci]
        lugares_aula[li]["coord"] = {"x": c["x"], "y": c["y"]}

    n_actualizados = len(asignados)
    n_sin_match   = len(lugares_aula) - n_actualizados
    print(f"    ✓ {n_actualizados} aulas actualizadas  |  {n_sin_match} sin match (coord. estimada)")


# -----------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------

def main():
    with open(JSON_IN, encoding="utf-8") as f:
        data = json.load(f)

    PLANOS = _planos()

    for edificio in data["edificios"]:
        for piso in edificio["pisos"]:
            num   = piso["numero"]
            label = piso["etiqueta"]
            png   = PLANOS.get(num)

            if png is None or not png.exists():
                print(f"  [SKIP] {label}: no se encontró {png}")
                continue

            # Actualizar ruta del plano en el JSON
            piso["plano"] = f"/planos/{png.name}"
            print(f"\n  [{label}] {png.name}")

            # Detectar círculos
            resultado = detectar_circulos(str(png), min_px=MIN_PX.get(num, 800))
            centroides, W, H = resultado
            print(f"    {len(centroides)} círculos detectados  ({W}×{H}px)")

            # Separar aulas (tienen círculo) del resto
            aulas = [l for l in piso["lugares"] if l["tipo"] == "aula"]
            print(f"    {len(aulas)} aulas en JSON")

            if centroides:
                asignar_coordenadas(aulas, centroides)
            else:
                print(f"    ⚠️  Sin círculos detectados — se mantienen coordenadas actuales")

    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅  campus.json actualizado en {JSON_OUT}")


if __name__ == "__main__":
    main()
