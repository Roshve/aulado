"""Exportación de borradores a JSON."""
from __future__ import annotations

import json
from pathlib import Path

from .models import DraftFloorGraph


def export_draft(draft: DraftFloorGraph, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(draft.to_dict(), indent=2, ensure_ascii=False) + '\n')
