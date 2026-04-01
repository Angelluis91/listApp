// Estado global de la aplicación. Todas las variables compartidas entre módulos viven aquí
export const state = {
  mainState: {},          // { 'secId|item': bool } — qué items están marcados
  mainStructure: [],      // [{ id, icon, name, items: [string] }] — secciones editables
  customLists: [],        // [{ id, name, emoji, items: [{id, label, done}] }]
  showPendingOnly: false,
  currentListId: null,
  selectedEmoji: '📝',
  mainListener: null,
  listsListener: null,
  structureListener: null,
};

// Restaura el estado a sus valores iniciales y cancela los listeners de Firestore activos
export function resetState() {
  state.mainState = {};
  state.mainStructure = [];
  state.customLists = [];
  state.showPendingOnly = false;
  state.currentListId = null;
  state.selectedEmoji = '📝';
  if (state.mainListener)     { state.mainListener();     state.mainListener = null; }
  if (state.listsListener)    { state.listsListener();    state.listsListener = null; }
  if (state.structureListener){ state.structureListener(); state.structureListener = null; }
}
