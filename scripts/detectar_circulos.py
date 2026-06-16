#!/usr/bin/env python3
"""
detectar_circulos.py — detecta centroides de círculos rojos en los planos del campus.

Uso:
  python3 scripts/detectar_circulos.py <imagen.png> [--escala N]

Salida: JSON por stdout con lista de centroides {x%, y%, px, py} ordenados por (y, x).
"""
import sys
import json
import numpy as np
from PIL import Image

def detectar_rojos(img_path, scale_down=4):
    """
    Carga la imagen, detecta píxeles rojos de los círculos y devuelve
    una lista de centroides en porcentaje sobre el tamaño de la imagen.
    """
    img = Image.open(img_path).convert("RGB")
    W, H = img.size
    arr = np.array(img, dtype=np.int16)   # int16 para restas sin overflow

    R = arr[:, :, 0]
    G = arr[:, :, 1]
    B = arr[:, :, 2]

    # Máscara: rojo intenso de los círculos del mapa
    #   R > 160, R−G > 80, R−B > 80  (excluye naranjas, rosas suaves, grises)
    mask = (R > 160) & ((R - G) > 80) & ((R - B) > 80)

    # Bajar resolución para agrupar píxeles contiguos rápidamente
    # (cada celda = scale_down×scale_down px)
    S = scale_down
    rows, cols = np.where(mask)
    if len(rows) == 0:
        return []

    # Celda de cada píxel rojo
    cell_r = rows // S
    cell_c = cols // S

    # Agregar píxeles a sus celdas
    grid_H = (H + S - 1) // S
    grid_W = (W + S - 1) // S
    density = np.zeros((grid_H, grid_W), dtype=np.int32)
    np.add.at(density, (cell_r, cell_c), 1)

    # Umbral: celda "activa" si tiene ≥ 5 px rojos (filtra ruido)
    active = density >= 5

    # BFS para etiquetar componentes conexas en el grid reducido
    labels = np.zeros_like(active, dtype=np.int32)
    label_id = 0
    neighbors_4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]

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

    # Calcular centroide de cada componente (en coordenadas de píxel original)
    # Usando píxeles rojos reales, no el grid
    # Creamos un mapa label_id por cada píxel rojo
    pix_labels = labels[rows // S, cols // S]

    centroides = []
    for lid in range(1, label_id + 1):
        sel = pix_labels == lid
        if sel.sum() < 20:   # blob demasiado chico → ruido
            continue
        cy_px = float(rows[sel].mean())
        cx_px = float(cols[sel].mean())
        cx_pct = round(cx_px / W * 100, 2)
        cy_pct = round(cy_px / H * 100, 2)
        centroides.append({
            "x": cx_pct,
            "y": cy_pct,
            "px": round(cx_px),
            "py": round(cy_px),
            "pixels_rojos": int(sel.sum()),
        })

    # Fusionar centroides muy cercanos (fragmentos del mismo círculo)
    # Threshold: 3.5% del ancho de imagen (~105px sobre 3000px)
    MERGE_THRESH = 3.5
    merged = True
    while merged:
        merged = False
        kept = []
        used = set()
        for i, a in enumerate(centroides):
            if i in used:
                continue
            group = [a]
            for j, b in enumerate(centroides):
                if j <= i or j in used:
                    continue
                if abs(a["x"] - b["x"]) < MERGE_THRESH and abs(a["y"] - b["y"]) < MERGE_THRESH:
                    group.append(b)
                    used.add(j)
            if len(group) > 1:
                merged = True
            total_px = sum(g["pixels_rojos"] for g in group)
            cx = sum(g["x"] * g["pixels_rojos"] for g in group) / total_px
            cy = sum(g["y"] * g["pixels_rojos"] for g in group) / total_px
            kept.append({
                "x": round(cx, 2),
                "y": round(cy, 2),
                "px": round(cx * W / 100),
                "py": round(cy * H / 100),
                "pixels_rojos": total_px,
            })
            used.add(i)
        centroides = kept

    # Filtrar ruido (blobs muy chicos tras el merge)
    centroides = [c for c in centroides if c["pixels_rojos"] >= 500]

    # Ordenar por fila (y) luego columna (x), lectura natural
    centroides.sort(key=lambda c: (round(c["y"]), round(c["x"])))
    return centroides, W, H


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 detectar_circulos.py <imagen.png>", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    result = detectar_rojos(path)
    centroides, W, H = result
    out = {
        "imagen": path,
        "dimensiones": {"ancho": W, "alto": H},
        "total": len(centroides),
        "centroides": centroides,
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))
