// Tests unitarios para appState: verifica valores iniciales, mutabilidad y la función resetState
import { describe, it, expect, beforeEach } from 'vitest';
import { state, resetState } from '../../src/state/appState.js';

describe('appState', () => {
  beforeEach(() => {
    resetState();
  });

  it('tiene los valores iniciales correctos', () => {
    expect(state.mainState).toEqual({});
    expect(state.mainStructure).toEqual([]);
    expect(state.customLists).toEqual([]);
    expect(state.showPendingOnly).toBe(false);
    expect(state.currentListId).toBeNull();
    expect(state.selectedEmoji).toBe('📝');
    expect(state.mainListener).toBeNull();
    expect(state.listsListener).toBeNull();
    expect(state.structureListener).toBeNull();
  });

  it('permite mutar mainState directamente', () => {
    state.mainState['frutas|Manzanas'] = true;
    expect(state.mainState['frutas|Manzanas']).toBe(true);
  });

  it('permite añadir secciones a mainStructure', () => {
    state.mainStructure.push({ id: 'sec_1', icon: '🥦', name: 'Verduras', items: [] });
    expect(state.mainStructure).toHaveLength(1);
    expect(state.mainStructure[0].name).toBe('Verduras');
  });

  it('permite añadir y leer customLists', () => {
    const lista = { id: '1', name: 'Farmacia', emoji: '💊', items: [] };
    state.customLists.push(lista);
    expect(state.customLists).toHaveLength(1);
    expect(state.customLists[0].name).toBe('Farmacia');
  });

  it('resetState limpia mainState, mainStructure y customLists', () => {
    state.mainState['sec|item'] = true;
    state.mainStructure.push({ id: 'sec_1', icon: '📦', name: 'Test', items: [] });
    state.customLists.push({ id: '1' });

    resetState();

    expect(state.mainState).toEqual({});
    expect(state.mainStructure).toEqual([]);
    expect(state.customLists).toEqual([]);
  });

  it('resetState llama y limpia mainListener si existe', () => {
    let cancelado = false;
    state.mainListener = () => { cancelado = true; };

    resetState();

    expect(cancelado).toBe(true);
    expect(state.mainListener).toBeNull();
  });

  it('resetState llama y limpia structureListener si existe', () => {
    let cancelado = false;
    state.structureListener = () => { cancelado = true; };

    resetState();

    expect(cancelado).toBe(true);
    expect(state.structureListener).toBeNull();
  });

  it('resetState llama y limpia listsListener si existe', () => {
    let cancelado = false;
    state.listsListener = () => { cancelado = true; };

    resetState();

    expect(cancelado).toBe(true);
    expect(state.listsListener).toBeNull();
  });
});
