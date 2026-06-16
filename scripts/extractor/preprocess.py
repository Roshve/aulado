"""Preproceso de planos: máscara de paredes y grid de ocupación."""
from __future__ import annotations

import cv2
import numpy as np
from numpy.typing import NDArray

# Umbrales alineados con verificar_grafo.py
BRILLO_PARED = 140


def es_rojo(R: NDArray[np.int16], G: NDArray[np.int16], B: NDArray[np.int16]) -> NDArray[np.bool_]:
    return (R > 160) & ((R - G) > 80) & ((R - B) > 80)


def mascara_paredes(rgb: NDArray[np.uint8]) -> NDArray[np.bool_]:
    """True donde hay pared (oscuro y no rojo de marcadores)."""
    arr = rgb.astype(np.int16)
    R, G, B = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    brillo = (R + G + B) // 3
    return (brillo < BRILLO_PARED) & ~es_rojo(R, G, B)


def occupancy_grid(rgb: NDArray[np.uint8], pared: NDArray[np.bool_] | None = None) -> NDArray[np.bool_]:
    """
    Áreas caminables: no pared, no marcadores rojos.
    Aplica cierre morfológico para cerrar pequeños huecos en pasillos.
    """
    if pared is None:
        pared = mascara_paredes(rgb)

    walkable = ~pared
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    walk_u8 = walkable.astype(np.uint8) * 255
    closed = cv2.morphologyEx(walk_u8, cv2.MORPH_CLOSE, kernel, iterations=2)
    return closed > 127


def load_image(path: str) -> tuple[NDArray[np.uint8], int, int]:
    bgr = cv2.imread(path)
    if bgr is None:
        raise FileNotFoundError(f'No se pudo cargar la imagen: {path}')
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    return rgb, w, h
