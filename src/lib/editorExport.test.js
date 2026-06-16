import { describe, it, expect } from 'vitest';
import {
  exportPisoCompleto,
  parseImportGrafo,
  parseImportCampus,
  aplicarSugerenciasPuertas,
  grafoFragmento,
} from './editorExport.js';

describe('exportPisoCompleto', () => {
  it('genera resumen con conteos', () => {
    const out = exportPisoCompleto({
      pisoNumero: 0,
      pisoEtiqueta: 'Planta Baja',
      nodos: [{ id: 'n1', x: 1, y: 2 }],
      aristas: [['n1', 'n2']],
      lugares: [{
        id: 'pb-01',
        nombre: 'Aula',
        tipo: 'aula',
        coord: { x: 10, y: 20 },
        puerta: { x: 11, y: 21 },
        pisoNumero: 0,
      }],
    });
    expect(out.resumen.nodos).toBe(1);
    expect(out.resumen.aristas).toBe(1);
    expect(out.resumen.lugares).toBe(1);
    expect(out.resumen.puertas).toBe(1);
    expect(out.campus.lugares[0].id).toBe('pb-01');
    expect(out.campus.lugares[0].pisoNumero).toBeUndefined();
  });
});

describe('parseImportGrafo', () => {
  it('parsea borrador del extractor', () => {
    const { nodos, aristas } = parseImportGrafo({
      nodes: [{ id: 'n1', x: 5, y: 6 }],
      edges: [{ a: 'n1', b: 'n2' }],
    });
    expect(nodos).toHaveLength(1);
    expect(aristas).toEqual([['n1', 'n2']]);
  });
});

describe('parseImportCampus', () => {
  it('parsea array de lugares', () => {
    const lugares = parseImportCampus([{ id: 'a', coord: { x: 1, y: 2 }, tipo: 'aula' }]);
    expect(lugares[0].coord).toEqual({ x: 1, y: 2 });
  });
});

describe('aplicarSugerenciasPuertas', () => {
  it('aplica puerta sugerida', () => {
    const lugares = [{ id: 's-01', coord: { x: 1, y: 2 } }];
    const out = aplicarSugerenciasPuertas(lugares, [{
      id: 's-01',
      status: 'ok',
      puerta: { x: 3, y: 4, join: 'a-b' },
    }]);
    expect(out[0].puerta).toEqual({ x: 3, y: 4, join: 'a-b' });
  });

  it('no sobrescribe si status skip', () => {
    const lugares = [{ id: 's-01', coord: { x: 1, y: 2 }, puerta: { x: 9, y: 9 } }];
    const out = aplicarSugerenciasPuertas(lugares, [{
      id: 's-01',
      status: 'skip',
      puerta: { x: 3, y: 4 },
    }]);
    expect(out[0].puerta.x).toBe(9);
  });
});

describe('grafoFragmento', () => {
  it('devuelve nodos y aristas', () => {
    expect(grafoFragmento([{ id: 'n1' }], [])).toEqual({ nodos: [{ id: 'n1' }], aristas: [] });
  });
});
