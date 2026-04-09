// Operaciones de Firestore para las listas personalizadas: suscripción, guardado, eliminación y renombrado
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db }    from '../config/firebase.js';
import { state } from '../state/appState.js';
import { setSyncing, setOk, setError } from '../ui/syncIndicator.js';

const COL_LISTS = 'compra_lists';

// Suscribe a la colección de listas personalizadas; ordena en cliente para evitar índices compuestos
export function subscribeLists(onUpdate) {
  if (state.listsListener) state.listsListener();

  state.listsListener = onSnapshot(
    collection(db, COL_LISTS),
    (snap) => {
      // Ordenar por createdAt en cliente — evita el índice compuesto que bloqueaba la query
      state.customLists = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      setOk();
      if (onUpdate) onUpdate();
    },
    (err) => { console.error('[listsService] Error en suscripción:', err); setError(); }
  );
}

// Guarda o actualiza una lista personalizada completa en Firestore
export async function saveList(list) {
  setSyncing();
  try {
    const { id, ...data } = list;
    await setDoc(doc(db, COL_LISTS, id), data);
    setOk();
  } catch (err) {
    console.error('[listsService] Error al guardar lista:', err);
    setError();
  }
}

// Actualiza nombre, emoji y/o recordatorio de una lista sin tocar sus items
export async function updateListMeta(listId, { name, emoji, reminder }) {
  const list = state.customLists.find(l => l.id === listId);
  if (!list) return;
  if (name     !== undefined) list.name     = name;
  if (emoji    !== undefined) list.emoji    = emoji;
  if (reminder !== undefined) list.reminder = reminder;
  await saveList(list);
}

// Elimina una lista personalizada de Firestore por su ID
export async function deleteListFromDB(id) {
  setSyncing();
  try {
    await deleteDoc(doc(db, COL_LISTS, id));
    setOk();
  } catch (err) {
    console.error('[listsService] Error al eliminar lista:', err);
    setError();
  }
}
