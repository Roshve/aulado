#!/usr/bin/env python3
"""
migrar_ids_grafo.py — renombra IDs de waypoints para evitar colisiones globales.

Subsuelo (-1): n3, n5, n12, n14, n1, n2 → s-n3, s-n5, s-n12, s-n14, s-n8, s-n9
Planta baja (0): pb-n* → n*
Verticales: pb-n101 → n101

Uso:
  python3 scripts/migrar_ids_grafo.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).parent.parent
GRAFO_PATH = RAIZ / 'src/data/grafo.json'
CAMPUS_PATH = RAIZ / 'src/data/campus.json'

# Subsuelo: ids sin prefijo s- → con prefijo (isla n1/n2 → s-n8/s-n9)
RENAME_SUBSUELO = {
    'n3': 's-n3',
    'n5': 's-n5',
    'n12': 's-n12',
    'n14': 's-n14',
    'n1': 's-n8',
    'n2': 's-n9',
}

# Planta baja: pb-n\d+ → n\d+
PB_N_RE = re.compile(r'^pb-(n\d+)$')

# Join strings en campus.json (segmento canónico sorted)
RENAME_JOIN = {
    'n5-n3': 's-n3-s-n5',
    'n5-n12': 's-n12-s-n5',
    'n12-s-n5': 's-n12-s-n5',
    'n3-s-n7': 's-n3-s-n7',
    'n14-n3': 's-n14-s-n3',
}

# Verticales globales
RENAME_GLOBAL = {
    'pb-n101': 'n101',
}


def rename_node_id(nid: str) -> str:
    if nid in RENAME_GLOBAL:
        return RENAME_GLOBAL[nid]
    if nid in RENAME_SUBSUELO:
        return RENAME_SUBSUELO[nid]
    m = PB_N_RE.match(nid)
    if m:
        return m.group(1)
    return nid


def rename_join(join: str) -> str:
    return RENAME_JOIN.get(join, join)


def migrate_grafo(grafo: dict) -> list[str]:
    changes: list[str] = []
    for vert in grafo.get('verticales', []):
        new_nodos = []
        for nid in vert.get('nodos', []):
            new_id = rename_node_id(nid)
            if new_id != nid:
                changes.append(f'vertical {vert.get("tipo")}: {nid} → {new_id}')
            new_nodos.append(new_id)
        vert['nodos'] = new_nodos

    for piso_str, piso in grafo.get('pisos', {}).items():
        for n in piso.get('nodos', []):
            old = n['id']
            new = rename_node_id(old)
            if new != old:
                changes.append(f'piso {piso_str} nodo: {old} → {new}')
                n['id'] = new
        for a in piso.get('aristas', []):
            for i, nid in enumerate(a):
                new = rename_node_id(nid)
                if new != nid:
                    changes.append(f'piso {piso_str} arista: {nid} → {new}')
                a[i] = new
    return changes


def migrate_campus(campus: dict) -> list[str]:
    changes: list[str] = []
    for edificio in campus.get('edificios', []):
        for piso in edificio.get('pisos', []):
            if int(piso.get('numero', 0)) != -1:
                continue
            for lugar in piso.get('lugares', []):
                puerta = lugar.get('puerta')
                if not puerta or 'join' not in puerta:
                    continue
                old = puerta['join']
                new = rename_join(old)
                if new != old:
                    changes.append(f'{lugar["id"]} puerta.join: {old} → {new}')
                    puerta['join'] = new
    return changes


def main():
    parser = argparse.ArgumentParser(description='Migrar IDs del grafo')
    parser.add_argument('--dry-run', action='store_true', help='Solo mostrar cambios')
    args = parser.parse_args()

    grafo = json.loads(GRAFO_PATH.read_text())
    campus = json.loads(CAMPUS_PATH.read_text())

    grafo_changes = migrate_grafo(grafo)
    campus_changes = migrate_campus(campus)
    all_changes = grafo_changes + campus_changes

    print(f'Cambios en grafo.json: {len(grafo_changes)}')
    for c in grafo_changes:
        print(f'  {c}')
    print(f'Cambios en campus.json: {len(campus_changes)}')
    for c in campus_changes:
        print(f'  {c}')

    if not all_changes:
        print('Nada que migrar.')
        return

    if args.dry_run:
        print('\n(dry-run — no se escribieron archivos)')
        sys.exit(0)

    GRAFO_PATH.write_text(json.dumps(grafo, indent=2, ensure_ascii=False) + '\n')
    CAMPUS_PATH.write_text(json.dumps(campus, indent=2, ensure_ascii=False) + '\n')
    print(f'\nEscritos {GRAFO_PATH.relative_to(RAIZ)} y {CAMPUS_PATH.relative_to(RAIZ)}')


if __name__ == '__main__':
    main()
