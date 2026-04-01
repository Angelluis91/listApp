// Tests de rendimiento para la configuración de Firebase y tiempos de respuesta de las suscripciones
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SUBSCRIPTION_THRESHOLD_MS = 50;  // tiempo máximo aceptable desde snapshot hasta state actualizado

// ── Mocks de Firebase ──────────────────────────────────────────────────────────
const { mockOnSnapshot, mockSetDoc, mockDoc, mockCollection } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockSetDoc:     vi.fn(),
  mockDoc:        vi.fn(() => ({})),
  mockCollection: vi.fn(() => ({})),
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

import { subscribeMain, subscribeStructure } from '../../src/services/mainService.js';
import { subscribeLists }                    from '../../src/services/listsService.js';
import { state, resetState }                 from '../../src/state/appState.js';

// Genera N documentos de lista falsos para simular carga real
function makeListDocs(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `list_${i}`,
    data: () => ({ name: `Lista ${i}`, emoji: '📝', items: [], createdAt: i }),
  }));
}

// Genera un snapshot con N items planos (con store y price) para simular la lista principal
function makeStructureSnap(count) {
  const items = Array.from({ length: count }, (_, i) => ({
    id:    `item_${i}`,
    label: `Producto ${i}`,
    store: i % 2 === 0 ? 'mercadona' : 'alcampo',
    price: 1.50,
  }));
  return { exists: () => true, data: () => ({ items }) };
}

// Genera un snapshot con formato antiguo de secciones para probar la migración
function makeLegacyStructureSnap(sections, itemsPerSection) {
  const data = Array.from({ length: sections }, (_, s) => ({
    id:    `sec_${s}`,
    icon:  '📦',
    name:  `Sección ${s}`,
    items: Array.from({ length: itemsPerSection }, (_, i) => `Item ${s}_${i}`),
  }));
  return { exists: () => true, data: () => ({ sections: data }) };
}

describe('Firebase — rendimiento de suscripciones', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockSetDoc.mockResolvedValue(undefined);
  });

  // ── subscribeMain ──────────────────────────────────────────────────────────
  describe('subscribeMain', () => {
    it(`actualiza state.mainState en menos de ${SUBSCRIPTION_THRESHOLD_MS}ms con snapshot vacío`, () => {
      const snap = { exists: () => true, data: () => ({}) };
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(snap); return vi.fn(); });

      const t0 = performance.now();
      subscribeMain(vi.fn());
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(SUBSCRIPTION_THRESHOLD_MS);
    });

    it(`actualiza state.mainState en menos de ${SUBSCRIPTION_THRESHOLD_MS}ms con 200 items marcados`, () => {
      const bigState = Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [`sec_${i % 10}|Item ${i}`, i % 2 === 0])
      );
      const snap = { exists: () => true, data: () => bigState };
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(snap); return vi.fn(); });

      const t0 = performance.now();
      subscribeMain(vi.fn());
      const elapsed = performance.now() - t0;

      expect(Object.keys(state.mainState)).toHaveLength(200);
      expect(elapsed).toBeLessThan(SUBSCRIPTION_THRESHOLD_MS);
    });
  });

  // ── subscribeStructure ─────────────────────────────────────────────────────
  describe('subscribeStructure', () => {
    it(`carga 200 items planos en menos de ${SUBSCRIPTION_THRESHOLD_MS}ms`, () => {
      const snap = makeStructureSnap(200);
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(snap); return vi.fn(); });

      const t0 = performance.now();
      subscribeStructure(vi.fn());
      const elapsed = performance.now() - t0;

      expect(state.mainStructure).toHaveLength(200);
      expect(state.mainStructure[0]).toHaveProperty('id');
      expect(state.mainStructure[0]).toHaveProperty('label');
      expect(elapsed).toBeLessThan(SUBSCRIPTION_THRESHOLD_MS);
    });

    it(`migra formato antiguo de 10 secciones × 20 items en menos de ${SUBSCRIPTION_THRESHOLD_MS}ms`, () => {
      const snap = makeLegacyStructureSnap(10, 20);
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(snap); return vi.fn(); });

      const t0 = performance.now();
      subscribeStructure(vi.fn());
      const elapsed = performance.now() - t0;

      // 10 secciones × 20 items = 200 items planos
      expect(state.mainStructure).toHaveLength(200);
      expect(state.mainStructure[0]).toHaveProperty('label');
      expect(elapsed).toBeLessThan(SUBSCRIPTION_THRESHOLD_MS);
    });
  });

  // ── subscribeLists ─────────────────────────────────────────────────────────
  describe('subscribeLists', () => {
    it(`procesa y ordena 20 listas en menos de ${SUBSCRIPTION_THRESHOLD_MS}ms`, () => {
      const docs = makeListDocs(20);
      // Desordenar para verificar que el sort no penaliza
      const shuffled = [...docs].reverse();
      mockOnSnapshot.mockImplementation((ref, cb) => { cb({ docs: shuffled }); return vi.fn(); });

      const t0 = performance.now();
      subscribeLists(vi.fn());
      const elapsed = performance.now() - t0;

      expect(state.customLists).toHaveLength(20);
      // Verificar que quedaron ordenadas por createdAt
      expect(state.customLists[0].id).toBe('list_0');
      expect(state.customLists[19].id).toBe('list_19');
      expect(elapsed).toBeLessThan(SUBSCRIPTION_THRESHOLD_MS);
    });

    it(`procesa y ordena 100 listas (caso extremo) en menos de ${SUBSCRIPTION_THRESHOLD_MS}ms`, () => {
      const docs = makeListDocs(100).reverse(); // desordenadas a propósito
      mockOnSnapshot.mockImplementation((ref, cb) => { cb({ docs }); return vi.fn(); });

      const t0 = performance.now();
      subscribeLists(vi.fn());
      const elapsed = performance.now() - t0;

      expect(state.customLists).toHaveLength(100);
      expect(elapsed).toBeLessThan(SUBSCRIPTION_THRESHOLD_MS);
    });
  });
});
