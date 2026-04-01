// Tests unitarios para statsUtils: verifica el cálculo de totales y completados en listas y secciones
import { describe, it, expect } from 'vitest';
import { mainStats, secStats, detailStats } from '../../src/utils/statsUtils.js';

// ─── Datos de prueba ────────────────────────────────────────────────────────
const mockData = [
  { id: 'frutas', items: ['Manzanas', 'Peras', 'Uvas'] },
  { id: 'bebidas', items: ['Agua', 'Leche'] },
];

// ─── mainStats ───────────────────────────────────────────────────────────────
describe('mainStats', () => {
  it('devuelve total=5 y done=0 cuando ningún item está marcado', () => {
    const state = {};
    const { total, done } = mainStats(mockData, state);
    expect(total).toBe(5);
    expect(done).toBe(0);
  });

  it('cuenta correctamente los items completados', () => {
    const state = {
      'frutas|Manzanas': true,
      'frutas|Peras': false,
      'frutas|Uvas': true,
      'bebidas|Agua': false,
      'bebidas|Leche': true,
    };
    const { total, done } = mainStats(mockData, state);
    expect(total).toBe(5);
    expect(done).toBe(3);
  });

  it('devuelve total=0 y done=0 con data vacía', () => {
    const { total, done } = mainStats([], {});
    expect(total).toBe(0);
    expect(done).toBe(0);
  });

  it('ignora claves de estado que no corresponden a ningún item', () => {
    const state = { 'inexistente|item': true };
    const { total, done } = mainStats(mockData, state);
    expect(total).toBe(5);
    expect(done).toBe(0);
  });
});

// ─── secStats ────────────────────────────────────────────────────────────────
describe('secStats', () => {
  const sec = { id: 'frutas', items: ['Manzanas', 'Peras', 'Uvas'] };

  it('devuelve done=0 cuando ningún item de la sección está marcado', () => {
    const { total, done } = secStats(sec, {});
    expect(total).toBe(3);
    expect(done).toBe(0);
  });

  it('cuenta solo los items de esa sección', () => {
    const state = {
      'frutas|Manzanas': true,
      'frutas|Peras': true,
      'bebidas|Leche': true, // no pertenece a esta sección
    };
    const { total, done } = secStats(sec, state);
    expect(total).toBe(3);
    expect(done).toBe(2);
  });

  it('devuelve done=total cuando todos los items están marcados', () => {
    const state = {
      'frutas|Manzanas': true,
      'frutas|Peras': true,
      'frutas|Uvas': true,
    };
    const { total, done } = secStats(sec, state);
    expect(total).toBe(3);
    expect(done).toBe(3);
  });
});

// ─── detailStats ─────────────────────────────────────────────────────────────
describe('detailStats', () => {
  it('devuelve {total:0, done:0} cuando la lista es null', () => {
    const { total, done } = detailStats(null);
    expect(total).toBe(0);
    expect(done).toBe(0);
  });

  it('devuelve {total:0, done:0} cuando la lista tiene items vacíos', () => {
    const { total, done } = detailStats({ items: [] });
    expect(total).toBe(0);
    expect(done).toBe(0);
  });

  it('cuenta correctamente los items completados en la lista', () => {
    const list = {
      items: [
        { id: '1', label: 'Leche', done: true },
        { id: '2', label: 'Pan', done: false },
        { id: '3', label: 'Huevos', done: true },
      ],
    };
    const { total, done } = detailStats(list);
    expect(total).toBe(3);
    expect(done).toBe(2);
  });

  it('devuelve done=total cuando todos los items están completados', () => {
    const list = {
      items: [
        { id: '1', label: 'A', done: true },
        { id: '2', label: 'B', done: true },
      ],
    };
    const { total, done } = detailStats(list);
    expect(total).toBe(2);
    expect(done).toBe(2);
  });
});
