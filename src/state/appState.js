// Estado global de la aplicación. Todas las variables compartidas entre módulos viven aquí
export const state = {
  mainState: {},          // { 'secId|item': bool }
  customLists: [],        // [{ id, name, emoji, items: [{id, label, done}] }]
  activeFilter: 'all',
  showPendingOnly: false,
  currentListId: null,
  selectedEmoji: '📝',
  mainListener: null,     // función para cancelar suscripción de Firestore
  listsListener: null,    // función para cancelar suscripción de Firestore
};

// Restaura el estado a sus valores iniciales y cancela los listeners de Firestore activos
export function resetState() {
  state.mainState = {};
  state.customLists = [];
  state.activeFilter = 'all';
  state.showPendingOnly = false;
  state.currentListId = null;
  state.selectedEmoji = '📝';
  if (state.mainListener) { state.mainListener(); state.mainListener = null; }
  if (state.listsListener) { state.listsListener(); state.listsListener = null; }
}
