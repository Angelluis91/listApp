// Tests unitarios para statsUtils: verifica el cálculo de totales y completados en listas
import { describe, it, expect } from 'vitest';
import { mainStats, detailStats } from '../../src/utils/statsUtils.js';

// ─── mainStats ────────────────────────────────────────────────────────────────
describe('mainStats', () => {
  const items = [
    { id: 'item_0', label: 'Manzanas' },
    { id: 'item_1', label: 'Peras' },
    { id: 'item_2', label: 'Uvas' },
    { id: 'item_3', label: 'Agua' },
    { id: 'item_4', label: 'Leche' },
  ];

  it('devuelve total=5 y done=0 cuando ningún item está marcado', () => {
    const { total, done } = mainStats(items, {});
    expect(total).toBe(5);
    expect(done).toBe(0);
  });

  it('cuenta correctamente los items completados', () => {
    const state = { item_0: true, item_1: false, item_2: true, item_3: false, item_4: true };
    const { total, done } = mainStats(items, state);
    expect(total).toBe(5);
    expect(done).toBe(3);
  });

  it('devuelve total=0 y done=0 con lista vacía', () => {
    const { total, done } = mainStats([], {});
    expect(total).toBe(0);
    expect(done).toBe(0);
  });

  it('ignora claves de estado que no corresponden a ningún item', () => {
    const state = { item_999: true };
    const { total, done } = mainStats(items, state);
    expect(total).toBe(5);
    expect(done).toBe(0);
  });

  it('devuelve done=total cuando todos los items están marcados', () => {
    const state = Object.fromEntries(items.map(i => [i.id, true]));
    const { total, done } = mainStats(items, state);
    expect(total).toBe(5);
    expect(done).toBe(5);
  });
});

// ─── detailStats ──────────────────────────────────────────────────────────────
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
        { id: '2', label: 'Pan',   done: false },
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
