"""Registro centralizado de planos — lee pisos desde campus.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAMPUS_PATH = ROOT / 'src' / 'data' / 'campus.json'


def _slug_etiqueta(etiqueta: str, numero: int) -> str:
    """Genera slug de archivo a partir de etiqueta o número de piso."""
    slug = re.sub(r'[^a-z0-9]+', '-', etiqueta.lower()).strip('-')
    if slug:
        return slug
    return f'piso-{numero}'


def cargar_campus() -> dict:
    return json.loads(CAMPUS_PATH.read_text(encoding='utf-8'))


def listar_pisos(campus: dict | None = None) -> list[dict]:
    """Lista todos los pisos con metadatos derivados."""
    campus = campus or cargar_campus()
    pisos: list[dict] = []
    for edificio in campus.get('edificios', []):
        for piso in edificio.get('pisos', []):
            numero = int(piso['numero'])
            etiqueta = piso.get('etiqueta', str(numero))
            plano_rel = piso.get('plano', '')
            if plano_rel.startswith('/planos/'):
                plano_path = ROOT / 'public' / plano_rel.lstrip('/')
            elif plano_rel:
                plano_path = ROOT / plano_rel.lstrip('/')
            else:
                plano_path = None
            slug = _slug_etiqueta(etiqueta, numero)
            pisos.append({
                'numero': numero,
                'etiqueta': etiqueta,
                'plano': plano_rel,
                'plano_path': plano_path,
                'slug': slug,
                'prefix': _prefix_nodo(numero),
            })
    return sorted(pisos, key=lambda p: p['numero'])


def _prefix_nodo(numero: int) -> str:
    if numero == -1:
        return 's'
    if numero == 0:
        return 'pb'
    if numero > 0:
        return f'p{numero}'
    return f'f{numero}'


def piso_por_numero(numero: int, campus: dict | None = None) -> dict | None:
    for p in listar_pisos(campus):
        if p['numero'] == numero:
            return p
    return None


def planos_dict(campus: dict | None = None) -> dict[int, Path]:
    """Mapa numero → Path absoluto al PNG (compat con scripts legacy)."""
    return {
        p['numero']: p['plano_path']
        for p in listar_pisos(campus)
        if p['plano_path'] is not None
    }


def nombres_dict(campus: dict | None = None) -> dict[int, str]:
    """Mapa numero → slug de nombre de archivo."""
    return {p['numero']: p['slug'] for p in listar_pisos(campus)}


def numeros_piso(campus: dict | None = None) -> list[int]:
    return [p['numero'] for p in listar_pisos(campus)]
