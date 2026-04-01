// Tests unitarios para listsService: verifica la suscripción, guardado y eliminación de listas personalizadas
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockOnSnapshot, mockSetDoc, mockDeleteDoc, mockDoc, mockCollection, mockQuery, mockOrderBy } = vi.hoisted(() => ({
  mockOnSnapshot:  vi.fn(),
  mockSetDoc:      vi.fn(),
  mockDeleteDoc:   vi.fn(),
  mockDoc:         vi.fn(() => ({})),
  mockCollection:  vi.fn(() => ({})),
  mockQuery:       vi.fn(col => col),
  mockOrderBy:     vi.fn(),
}));

vi.mock('../../src/config/firebase.js', () => ({ db: {} }));
vi.mock('../../src/ui/syncIndicator.js', () => ({
  setSyncing: vi.fn(),
  setOk:      vi.fn(),
  setError:   vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  collection:  mockCollection,
  doc:         mockDoc,
  onSnapshot:  mockOnSnapshot,
  setDoc:      mockSetDoc,
  deleteDoc:   mockDeleteDoc,
  query:       mockQuery,
  orderBy:     mockOrderBy,
}));

import { subscribeLists, saveList, deleteListFromDB } from '../../src/services/listsService.js';
import { state, resetState }                          from '../../src/state/appState.js';
import { setSyncing, setOk, setError }                from '../../src/ui/syncIndicator.js';

describe('listsService', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
  });

  // ── subscribeLists ─────────────────────────────────────────────────────────
  describe('subscribeLists', () => {
    it('llama a onSnapshot una vez', () => {
      subscribeLists(vi.fn());
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    });

    it('guarda la función unsubscribe en state.listsListener', () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubscribe);
      subscribeLists(vi.fn());
      expect(state.listsListener).toBe(unsubscribe);
    });

    it('cancela el listener anterior antes de crear uno nuevo', () => {
      const cancel1 = vi.fn();
      state.listsListener = cancel1;
      subscribeLists(vi.fn());
      expect(cancel1).toHaveBeenCalledTimes(1);
    });

    it('mapea correctamente los docs de Firestore a state.customLists', () => {
      const onUpdate = vi.fn();
      const mockDocs = [
        { id: 'id1', data: () => ({ name: 'Farmacia', emoji: '💊', items: [], createdAt: 1 }) },
        { id: 'id2', data: () => ({ name: 'Viaje',    emoji: '✈️',  items: [], createdAt: 2 }) },
      ];
      mockOnSnapshot.mockImplementation((ref, successCb) => { successCb({ docs: mockDocs }); return vi.fn(); });

      subscribeLists(onUpdate);

      expect(state.customLists).toHaveLength(2);
      expect(state.customLists[0].id).toBe('id1');
      expect(state.customLists[0].name).toBe('Farmacia');
      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('llama a setError y no a onUpdate cuando el snapshot falla', () => {
      const onUpdate = vi.fn();
      mockOnSnapshot.mockImplementation((ref, _cb, errorCb) => { errorCb(new Error('fail')); return vi.fn(); });

      subscribeLists(onUpdate);

      expect(setError).toHaveBeenCalledTimes(1);
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  // ── saveList ───────────────────────────────────────────────────────────────
  describe('saveList', () => {
    it('llama a setSyncing, setDoc y setOk en caso exitoso', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const list = { id: 'abc123', name: 'Test', emoji: '📝', items: [], createdAt: 1 };

      await saveList(list);

      expect(setSyncing).toHaveBeenCalledTimes(1);
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      expect(setOk).toHaveBeenCalledTimes(1);
    });

    it('no incluye el campo id en los datos guardados en Firestore', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const list = { id: 'abc123', name: 'Test', emoji: '📝', items: [], createdAt: 1 };

      await saveList(list);

      const [, dataArg] = mockSetDoc.mock.calls[0];
      expect(dataArg).not.toHaveProperty('id');
      expect(dataArg).toHaveProperty('name', 'Test');
    });

    it('llama a setError cuando setDoc falla', async () => {
      mockSetDoc.mockRejectedValue(new Error('Network error'));
      await saveList({ id: '1', name: 'X', emoji: '📝', items: [], createdAt: 1 });
      expect(setError).toHaveBeenCalledTimes(1);
    });
  });

  // ── deleteListFromDB ───────────────────────────────────────────────────────
  describe('deleteListFromDB', () => {
    it('llama a setSyncing, deleteDoc y setOk en caso exitoso', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await deleteListFromDB('abc123');

      expect(setSyncing).toHaveBeenCalledTimes(1);
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
      expect(setOk).toHaveBeenCalledTimes(1);
    });

    it('llama a setError cuando deleteDoc falla', async () => {
      mockDeleteDoc.mockRejectedValue(new Error('Network error'));
      await deleteListFromDB('abc123');
      expect(setError).toHaveBeenCalledTimes(1);
    });
  });
});
