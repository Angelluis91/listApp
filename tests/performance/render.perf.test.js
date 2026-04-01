// Tests de rendimiento para las funciones de render de UI: miden tiempo de pintado con datasets realistas y extremos
import { describe, it, expect, vi, beforeEach } from 'vitest';

// jsdom es ~3-5x más lento que un navegador real; estos umbrales miden regresiones, no velocidad de producción
const RENDER_THRESHOLD_MS        = 300;  // render estándar (jsdom overhead incluido)
const RENDER_THRESHOLD_EXTREME   = 500;  // render caso extremo (17 secciones × 20 items)
const RENDER_THRESHOLD_EMPTY_MS  = 10;   // render vacío — debe ser siempre instantáneo

// ── Mocks de dependencias externas ────────────────────────────────────────────
const { mockSetDoc, mockDoc, mockCollection, mockOnSnapshot } = vi.hoisted(() => ({
  mockSetDoc:     vi.fn(),
  mockDoc:        vi.fn(() => ({})),
  mockCollection: vi.fn(() => ({})),
  mockOnSnapshot: vi.fn(() => vi.fn()),
}));

vi.mock('../../src/config/firebase.js', () => ({ db: {} }));
vi.mock('../../src/ui/syncIndicator.js', () => ({
  setSyncing: vi.fn(), setOk: vi.fn(), setError: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc:        mockDoc,
  collection: mockCollection,
  onSnapshot: mockOnSnapshot,
  setDoc:     mockSetDoc,
}));

import { state, resetState } from '../../src/state/appState.js';
import { renderMain }        from '../../src/ui/mainList.js';
import { renderLists }       from '../../src/ui/customLists.js';
import { renderDetail }      from '../../src/ui/detail.js';

// Monta el DOM mínimo necesario para cada pantalla
function setupMainDOM() {
  document.body.innerHTML = `
    <div id="selected-summary"></div>
    <input id="main-search" value="">
    <div id="main-sections"></div>
    <div id="s-total"></div>
    <div id="s-done"></div>
    <div id="g-prog" style="width:0%"></div>
  `;
}

function setupListsDOM() {
  document.body.innerHTML = `<div id="lists-container"></div>`;
}

function setupDetailDOM() {
  document.body.innerHTML = `
    <div id="detail-items"></div>
    <div id="d-total"></div>
    <div id="d-done"></div>
    <div id="d-prog" style="width:0%"></div>
  `;
}

// Genera una estructura de secciones con N items por sección
function makeStructure(sections, itemsPerSection) {
  return Array.from({ length: sections }, (_, s) => ({
    id:    `sec_${s}`,
    icon:  '📦',
    name:  `Sección ${s}`,
    items: Array.from({ length: itemsPerSection }, (_, i) => `Item ${s}_${i}`),
  }));
}

// Genera N listas personalizadas con M items cada una
function makeLists(n, itemsPerList = 10) {
  return Array.from({ length: n }, (_, i) => ({
    id:        `list_${i}`,
    name:      `Lista ${i}`,
    emoji:     '📝',
    createdAt: i,
    items:     Array.from({ length: itemsPerList }, (_, j) => ({
      id: `item_${i}_${j}`, label: `Producto ${j}`, done: j % 3 === 0,
    })),
  }));
}

describe('Render — rendimiento de pintado DOM', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    mockSetDoc.mockResolvedValue(undefined);
  });

  // ── renderMain ─────────────────────────────────────────────────────────────
  describe('renderMain', () => {
    it(`pinta 5 secciones × 10 items (caso real) en menos de ${RENDER_THRESHOLD_MS}ms`, () => {
      setupMainDOM();
      state.mainStructure = makeStructure(5, 10);

      const t0 = performance.now();
      renderMain();
      const elapsed = performance.now() - t0;

      const cards = document.querySelectorAll('.section-card');
      expect(cards).toHaveLength(5);
      expect(elapsed).toBeLessThan(RENDER_THRESHOLD_MS);
    });

    it(`pinta 17 secciones × 20 items (caso extremo) en menos de ${RENDER_THRESHOLD_EXTREME}ms`, () => {
      setupMainDOM();
      state.mainStructure = makeStructure(17, 20);

      const t0 = performance.now();
      renderMain();
      const elapsed = performance.now() - t0;

      expect(document.querySelectorAll('.section-card')).toHaveLength(17);
      expect(elapsed).toBeLessThan(RENDER_THRESHOLD_EXTREME);
    });

    it(`pinta correctamente items marcados (checked) sin penalizar el tiempo`, () => {
      setupMainDOM();
      state.mainStructure = makeStructure(5, 10);
      // Marcar la mitad de los items
      state.mainStructure.forEach(sec =>
        sec.items.forEach((item, i) => {
          if (i % 2 === 0) state.mainState[`${sec.id}|${item}`] = true;
        })
      );

      const t0 = performance.now();
      renderMain();
      const elapsed = performance.now() - t0;

      expect(document.querySelectorAll('.item-row.checked').length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(RENDER_THRESHOLD_MS);
    });

    it(`renderMain sin secciones muestra el mensaje vacío en menos de ${RENDER_THRESHOLD_EMPTY_MS}ms`, () => {
      setupMainDOM();
      state.mainStructure = [];

      const t0 = performance.now();
      renderMain();
      const elapsed = performance.now() - t0;

      expect(document.querySelector('.empty')).toBeTruthy();
      expect(elapsed).toBeLessThan(RENDER_THRESHOLD_EMPTY_MS);
    });
  });

  // ── renderLists ────────────────────────────────────────────────────────────
  describe('renderLists', () => {
    it(`pinta 10 listas (caso real) en menos de ${RENDER_THRESHOLD_MS}ms`, () => {
      setupListsDOM();
      state.customLists = makeLists(10);

      const t0 = performance.now();
      renderLists();
      const elapsed = performance.now() - t0;

      expect(document.querySelectorAll('.list-card')).toHaveLength(10);
      expect(elapsed).toBeLessThan(RENDER_THRESHOLD_MS);
    });

    it(`pinta 50 listas (caso extremo) en menos de ${RENDER_THRESHOLD_MS}ms`, () => {
      setupListsDOM();
      state.customLists = makeLists(50);

      const t0 = performance.now();
      renderLists();
      const elapsed = performance.now() - t0;

      expect(document.querySelectorAll('.list-card')).toHaveLength(50);
      expect(elapsed).toBeLessThan(RENDER_THRESHOLD_MS);
    });

    it(`renderLists sin listas muestra el mensaje vacío en menos de ${RENDER_THRESHOLD_EMPTY_MS}ms`, () => {
      setupListsDOM();
      state.customLists = [];

      const t0 = performance.now();
      renderLists();
      const elapsed = performance.now() - t0;

      expect(document.querySelector('.empty')).toBeTruthy();
      expect(elapsed).toBeLessThan(RENDER_THRESHOLD_EMPTY_MS);
    });
  });

  // ── renderDetail ───────────────────────────────────────────────────────────
  describe('renderDetail', () => {
    it(`pinta 30 items (caso real) en menos de ${RENDER_THRESHOLD_MS}ms`, () => {
      setupDetailDOM();
      const list = makeLists(1, 30)[0];
      state.customLists  = [list];
      state.currentListId = list.id;

      const t0 = performance.now();
      renderDetail();
      const elapsed = performance.now() - t0;

      expect(document.querySelectorAll('.detail-item')).toHaveLength(30);
      expect(elapsed).toBeLessThan(RENDER_THRESHOLD_MS);
    });

    it(`pinta 100 items (caso extremo) en menos de ${RENDER_THRESHOLD_MS}ms`, () => {
      setupDetailDOM();
      const list = makeLists(1, 100)[0];
      state.customLists   = [list];
      state.currentListId = list.id;

      const t0 = performance.now();
      renderDetail();
      const elapsed = performance.now() - t0;

      expect(document.querySelectorAll('.detail-item')).toHaveLength(100);
      expect(elapsed).toBeLessThan(RENDER_THRESHOLD_MS);
    });

    it(`renderDetail con lista vacía muestra mensaje vacío en menos de ${RENDER_THRESHOLD_EMPTY_MS}ms`, () => {
      setupDetailDOM();
      const list = { id: 'empty', name: 'Vacía', emoji: '📝', items: [], createdAt: 1 };
      state.customLists   = [list];
      state.currentListId = list.id;

      const t0 = performance.now();
      renderDetail();
      const elapsed = performance.now() - t0;

      expect(document.querySelector('.empty')).toBeTruthy();
      expect(elapsed).toBeLessThan(RENDER_THRESHOLD_EMPTY_MS);
    });
  });
});
