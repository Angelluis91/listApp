// Tests unitarios para mainService: suscripción y guardado de estado principal y estructura de items con tienda y precio
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockOnSnapshot, mockSetDoc, mockDoc } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockSetDoc:     vi.fn(),
  mockDoc:        vi.fn(() => ({})),
}));

vi.mock('../../src/config/firebase.js', () => ({ db: {} }));
vi.mock('../../src/ui/syncIndicator.js', () => ({
  setSyncing: vi.fn(), setOk: vi.fn(), setError: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc:        mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc:     mockSetDoc,
}));

import { subscribeMain, saveMain, subscribeStructure, saveStructure } from '../../src/services/mainService.js';
import { state, resetState }       from '../../src/state/appState.js';
import { setSyncing, setOk, setError } from '../../src/ui/syncIndicator.js';

describe('mainService', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockSetDoc.mockResolvedValue(undefined);
  });

  // ── subscribeMain ──────────────────────────────────────────────────────────
  describe('subscribeMain', () => {
    it('llama a onSnapshot una vez al suscribirse', () => {
      subscribeMain(vi.fn());
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    });

    it('guarda la función unsubscribe en state.mainListener', () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubscribe);
      subscribeMain(vi.fn());
      expect(state.mainListener).toBe(unsubscribe);
    });

    it('cancela el listener anterior antes de crear uno nuevo', () => {
      const cancel1 = vi.fn();
      state.mainListener = cancel1;
      subscribeMain(vi.fn());
      expect(cancel1).toHaveBeenCalledTimes(1);
    });

    it('actualiza state.mainState con los datos del snapshot cuando existe', () => {
      const mockSnap = { exists: () => true, data: () => ({ item_0: true }) };
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(mockSnap); return vi.fn(); });

      subscribeMain(vi.fn());

      expect(state.mainState['item_0']).toBe(true);
    });

    it('inicializa state.mainState a {} cuando el snapshot no existe', () => {
      const mockSnap = { exists: () => false };
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(mockSnap); return vi.fn(); });

      subscribeMain(vi.fn());

      expect(state.mainState).toEqual({});
    });

    it('llama a setError cuando el snapshot falla', () => {
      mockOnSnapshot.mockImplementation((ref, _cb, errorCb) => { errorCb(new Error('fail')); return vi.fn(); });
      subscribeMain(vi.fn());
      expect(setError).toHaveBeenCalledTimes(1);
    });
  });

  // ── saveMain ───────────────────────────────────────────────────────────────
  describe('saveMain', () => {
    it('llama a setSyncing, setDoc y setOk en caso exitoso', async () => {
      state.mainState = { item_0: true };
      await saveMain();
      expect(setSyncing).toHaveBeenCalledTimes(1);
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      expect(setOk).toHaveBeenCalledTimes(1);
    });

    it('llama a setError cuando setDoc lanza una excepción', async () => {
      mockSetDoc.mockRejectedValue(new Error('Network error'));
      await saveMain();
      expect(setError).toHaveBeenCalledTimes(1);
    });
  });

  // ── subscribeStructure ─────────────────────────────────────────────────────
  describe('subscribeStructure', () => {
    it('carga items con store y price desde el formato nuevo', () => {
      const items = [
        { id: 'item_0', label: 'Leche', store: 'mercadona', price: 2.80 },
        { id: 'item_1', label: 'Pan',   store: 'alcampo',   price: 1.50 },
      ];
      const mockSnap = { exists: () => true, data: () => ({ items }) };
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(mockSnap); return vi.fn(); });

      subscribeStructure(vi.fn());

      expect(state.mainStructure).toEqual(items);
    });

    it('enriquece items sin store/price usando mainState para inferir tienda', () => {
      state.mainState = { item_0: true }; // marcado → mercadona
      const items = [
        { id: 'item_0', label: 'Jamón' },      // marcado → mercadona
        { id: 'item_1', label: 'Cebolla' },    // no marcado → alcampo
      ];
      const mockSnap = { exists: () => true, data: () => ({ items }) };
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(mockSnap); return vi.fn(); });

      subscribeStructure(vi.fn());

      expect(state.mainStructure[0].store).toBe('mercadona');
      expect(state.mainStructure[1].store).toBe('alcampo');
      expect(typeof state.mainStructure[0].price).toBe('number');
      // Debe guardar la estructura enriquecida
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('migra el formato antiguo de secciones a items planos con store=alcampo', () => {
      const sections = [
        { id: 'frutas', icon: '🍎', name: 'Frutas', items: ['Manzana', 'Pera'] },
      ];
      const mockSnap = { exists: () => true, data: () => ({ sections }) };
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(mockSnap); return vi.fn(); });

      subscribeStructure(vi.fn());

      expect(state.mainStructure).toHaveLength(2);
      expect(state.mainStructure[0]).toMatchObject({ label: 'Manzana', store: 'alcampo' });
      expect(typeof state.mainStructure[0].price).toBe('number');
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('inicializa desde MAIN_DATA con store=alcampo y precios de PRICES cuando no existe', () => {
      const mockSnap = { exists: () => false };
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(mockSnap); return vi.fn(); });

      subscribeStructure(vi.fn());

      expect(state.mainStructure.length).toBeGreaterThan(0);
      expect(state.mainStructure[0]).toHaveProperty('store', 'alcampo');
      expect(state.mainStructure[0]).toHaveProperty('price');
      expect(typeof state.mainStructure[0].price).toBe('number');
    });

    it('llama a onUpdate cuando el snapshot llega correctamente', () => {
      const onUpdate = vi.fn();
      const mockSnap = { exists: () => true, data: () => ({ items: [] }) };
      mockOnSnapshot.mockImplementation((ref, cb) => { cb(mockSnap); return vi.fn(); });

      subscribeStructure(onUpdate);

      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('llama a setError cuando el snapshot falla', () => {
      mockOnSnapshot.mockImplementation((ref, _cb, errorCb) => { errorCb(new Error('fail')); return vi.fn(); });
      subscribeStructure(vi.fn());
      expect(setError).toHaveBeenCalledTimes(1);
    });
  });

  // ── saveStructure ──────────────────────────────────────────────────────────
  describe('saveStructure', () => {
    it('persiste items con store y price en { items: [...] }', async () => {
      const items = [{ id: 'item_0', label: 'Leche', store: 'mercadona', price: 2.80 }];
      state.mainStructure = items;

      await saveStructure();

      expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { items });
    });

    it('llama a setError cuando setDoc lanza una excepción', async () => {
      mockSetDoc.mockRejectedValue(new Error('Network error'));
      await saveStructure();
      expect(setError).toHaveBeenCalledTimes(1);
    });
  });
});
