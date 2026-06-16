import { describe, it, expect } from 'vitest';
import {
  calcularSpurLugar,
  segmentosCorredor,
  proyectarEnSegmento,
  distPct,
} from './editorSpurs.js';

describe('editorSpurs', () => {
  const nodos = [
    { id: 'n1', x: 0, y: 50 },
    { id: 'n2', x: 100, y: 50 },
  ];
  const aristas = [['n1', 'n2']];

  it('segmentosCorredor construye segmentos', () => {
    const segs = segmentosCorredor(nodos, aristas);
    expect(segs).toHaveLength(1);
    expect(segs[0].aId).toBe('n1');
  });

  it('proyectarEnSegmento proyecta al centro del segmento', () => {
    const r = proyectarEnSegmento({ x: 50, y: 60 }, { x: 0, y: 50 }, { x: 100, y: 50 });
    expect(r.punto.x).toBeCloseTo(50, 0);
    expect(r.dist).toBeGreaterThan(0);
  });

  it('calcularSpurLugar devuelve destino en corredor', () => {
    const lugar = { id: 'aula', coord: { x: 50, y: 30 } };
    const spur = calcularSpurLugar(lugar, nodos, aristas);
    expect(spur).not.toBeNull();
    expect(spur.destino.y).toBeCloseTo(50, 0);
    expect(spur.join).toBe('n1-n2');
  });

  it('usa puerta como origen si existe', () => {
    const lugar = {
      id: 'aula',
      coord: { x: 50, y: 30 },
      puerta: { x: 50, y: 45 },
    };
    const spur = calcularSpurLugar(lugar, nodos, aristas);
    expect(spur.origen.y).toBe(45);
  });

  it('distPct calcula distancia con aspect', () => {
    expect(distPct({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeGreaterThan(0);
  });
});
