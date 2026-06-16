"""Skeletonización de pasillos con scikit-image."""
from __future__ import annotations

import numpy as np
from numpy.typing import NDArray
from skimage.morphology import skeletonize, remove_small_objects


def extract_skeleton(walkable: NDArray[np.bool_], min_area: int = 200) -> NDArray[np.bool_]:
    """
    Reduce el grid caminable a una línea central de 1 px.
    Elimina islas pequeñas antes de skeletonizar.
    """
    cleaned = remove_small_objects(walkable, min_size=min_area)
    skel = skeletonize(cleaned)
    return skel.astype(bool)
