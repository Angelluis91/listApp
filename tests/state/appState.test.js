// Tests unitarios para appState: verifica valores iniciales, mutabilidad y la función resetState
import { describe, it, expect, beforeEach } from 'vitest';
import { state, resetState } from '../../src/state/appState.js';

describe('appState', () => {
  beforeEach(() => {
    resetState();
  });

  it('tiene los valores iniciales correctos', () => {
    expect(state.mainState).toEqual({});
    expect(state.customLists).toEqual([]);
    expect(state.activeFilter).toBe('all');
    expect(state.showPendingOnly).toBe(false);
    expect(state.currentListId).toBeNull();
    expect(state.selectedEmoji).toBe('📝');
    expect(state.mainListener).toBeNull();
    expect(state.listsListener).toBeNull();
  });

  it('permite mutar mainState directamente', () => {
    state.mainState['frutas|Manzanas'] = true;
    expect(state.mainState['frutas|Manzanas']).toBe(true);
  });

  it('permite añadir y leer customLists', () => {
    const lista = { id: '1', name: 'Farmacia', emoji: '💊', items: [] };
    state.customLists.push(lista);
    expect(state.customLists).toHaveLength(1);
    expect(state.customLists[0].name).toBe('Farmacia');
  });

  it('resetState limpia mainState y customLists', () => {
    state.mainState['sec|item'] = true;
    state.customLists.push({ id: '1' });
    state.activeFilter = 'frutas';

    resetState();

    expect(state.mainState).toEqual({});
    expect(state.customLists).toEqual([]);
    expect(state.activeFilter).toBe('all');
  });

  it('resetState llama y limpia los listeners si existen', () => {
    let cancelado = false;
    state.mainListener = () => { cancelado = true; };

    resetState();

    expect(cancelado).toBe(true);
    expect(state.mainListener).toBeNull();
  });
});
