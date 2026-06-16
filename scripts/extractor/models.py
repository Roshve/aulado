"""Modelos de datos tipados para el pipeline de extracción."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class Node:
    id: str
    x: float  # porcentaje 0-100
    y: float
    tipo: str = 'interseccion'

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Edge:
    a: str
    b: str
    peso: float | None = None
    accesible: bool = True

    def to_dict(self) -> dict[str, Any]:
        d = {'a': self.a, 'b': self.b}
        if self.peso is not None:
            d['peso'] = round(self.peso, 3)
        if not self.accesible:
            d['accesible'] = False
        return d


@dataclass
class Room:
    id: str
    x: float
    y: float
    label: str | None = None
    portal_node: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d = {'id': self.id, 'x': self.x, 'y': self.y}
        if self.label:
            d['label'] = self.label
        if self.portal_node:
            d['portalNodeId'] = self.portal_node
        return d


@dataclass
class DraftFloorGraph:
    floor: int
    source_image: str
    width_px: int
    height_px: int
    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)
    rooms: list[Room] = field(default_factory=list)
    stairs: list[str] = field(default_factory=list)
    elevators: list[str] = field(default_factory=list)
    confidence: float = 0.0

    def to_grafo_piso(self) -> dict[str, Any]:
        """Formato compatible con grafo.json → pisos[piso]."""
        return {
            'nodos': [n.to_dict() for n in self.nodes],
            'aristas': [[e.a, e.b] for e in self.edges],
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            'floor': self.floor,
            'sourceImage': self.source_image,
            'dimensions': {'ancho': self.width_px, 'alto': self.height_px},
            'nodes': [n.to_dict() for n in self.nodes],
            'edges': [e.to_dict() for e in self.edges],
            'rooms': [r.to_dict() for r in self.rooms],
            'stairs': self.stairs,
            'elevators': self.elevators,
            'confidence': round(self.confidence, 3),
            'grafoPiso': self.to_grafo_piso(),
        }
