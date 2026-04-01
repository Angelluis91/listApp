// Tests unitarios para mainService: verifica la suscripción a Firestore y el guardado del estado principal y estructura
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted permite definir variables que pueden usarse dentro de vi.mock factories
const { mockOnSnapshot, mockSetDoc, mockDoc } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockSetDoc:     vi.fn(),
  mockDoc:        vi.fn(() => ({})),
}));

vi.mock('../../src/config/firebase.js', () => ({ db: {} }));
vi.mock('../../src/ui/syncIndicator.js', () => ({
  setSyncing: vi.fn(),
  setOk:      vi.fn(),
  setError:   vi.fn(),
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
      const onUpdate = vi.fn();
      const mockSnap = { exists: () => true, data: () => ({ 'frutas|Manzanas': true }) };
      mockOnSnapshot.mockImplementation((ref, successCb) => { successCb(mockSnap); return vi.fn(); });

      subscribeMain(onUpdate);

      expect(state.mainState['frutas|Manzanas']).toBe(true);
      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('inicializa todo a false cuando el snapshot no existe (primera vez)', () => {
      const mockSnap = { exists: () => false };
      mockOnSnapshot.mockImplementation((ref, successCb) => { successCb(mockSnap); return vi.fn(); });

      subscribeMain(vi.fn());

      const keys = Object.keys(state.mainState);
      expect(keys.length).toBeGreaterThan(0);
      expect(Object.values(state.mainState).every(v => v === false)).toBe(true);
    });

    it('llama a setError y no a onUpdate cuando el snapshot falla', () => {
      const onUpdate = vi.fn();
      mockOnSnapshot.mockImplementation((ref, _cb, errorCb) => { errorCb(new Error('fail')); return vi.fn(); });

      subscribeMain(onUpdate);

      expect(setError).toHaveBeenCalledTimes(1);
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  // ── saveMain ───────────────────────────────────────────────────────────────
  describe('saveMain', () => {
    it('llama a setSyncing, setDoc y setOk en caso exitoso', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      state.mainState = { 'frutas|Manzanas': true };

      await saveMain();

      expect(setSyncing).toHaveBeenCalledTimes(1);
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      expect(setOk).toHaveBeenCalledTimes(1);
    });

    it('llama a setError cuando setDoc lanza una excepción', async () => {
      mockSetDoc.mockRejectedValue(new Error('Network error'));

      await saveMain();

      expect(setError).toHaveBeenCalledTimes(1);
      expect(setOk).not.toHaveBeenCalled();
    });
  });

  // ── subscribeStructure ─────────────────────────────────────────────────────
  describe('subscribeStructure', () => {
    it('llama a onSnapshot una vez al suscribirse', () => {
      subscribeStructure(vi.fn());
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    });

    it('guarda la función unsubscribe en state.structureListener', () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubscribe);
      subscribeStructure(vi.fn());
      expect(state.structureListener).toBe(unsubscribe);
    });

    it('cancela el listener anterior antes de crear uno nuevo', () => {
      const cancel1 = vi.fn();
      state.structureListener = cancel1;
      subscribeStructure(vi.fn());
      expect(cancel1).toHaveBeenCalledTimes(1);
    });

    it('carga state.mainStructure desde el snapshot cuando existe', () => {
      const sections = [{ id: 'sec_1', icon: '🥦', name: 'Verduras', items: ['Lechuga'] }];
      const mockSnap = { exists: () => true, data: () => ({ sections }) };
      mockOnSnapshot.mockImplementation((ref, successCb) => { successCb(mockSnap); return vi.fn(); });

      subscribeStructure(vi.fn());

      expect(state.mainStructure).toEqual(sections);
    });

    it('inicializa mainStructure desde MAIN_DATA cuando el snapshot no existe', () => {
      mockSetDoc.mockResolvedValue(undefined);
      const mockSnap = { exists: () => false };
      mockOnSnapshot.mockImplementation((ref, successCb) => { successCb(mockSnap); return vi.fn(); });

      subscribeStructure(vi.fn());

      expect(state.mainStructure.length).toBeGreaterThan(0);
      expect(state.mainStructure[0]).toHaveProperty('id');
      expect(state.mainStructure[0]).toHaveProperty('items');
    });

    it('llama a onUpdate cuando el snapshot llega correctamente', () => {
      const onUpdate = vi.fn();
      const mockSnap = { exists: () => true, data: () => ({ sections: [] }) };
      mockOnSnapshot.mockImplementation((ref, successCb) => { successCb(mockSnap); return vi.fn(); });

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
    it('llama a setSyncing, setDoc y setOk en caso exitoso', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      state.mainStructure = [{ id: 'sec_1', icon: '📦', name: 'General', items: [] }];

      await saveStructure();

      expect(setSyncing).toHaveBeenCalledTimes(1);
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      expect(setOk).toHaveBeenCalledTimes(1);
    });

    it('persiste las secciones envueltas en { sections: ... }', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const sections = [{ id: 'sec_1', icon: '📦', name: 'General', items: [] }];
      state.mainStructure = sections;

      await saveStructure();

      expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { sections });
    });

    it('llama a setError cuando setDoc lanza una excepción', async () => {
      mockSetDoc.mockRejectedValue(new Error('Network error'));

      await saveStructure();

      expect(setError).toHaveBeenCalledTimes(1);
      expect(setOk).not.toHaveBeenCalled();
    });
  });
});
