// Operaciones de Firestore para las listas personalizadas: suscripción en tiempo real, guardado y eliminación
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db }    from '../config/firebase.js';
import { state } from '../state/appState.js';
import { setSyncing, setOk, setError } from '../ui/syncIndicator.js';

const COL_LISTS = 'compra_lists';

/**
 * Suscribe a la colección de listas personalizadas en Firestore.
 * Llama a onUpdate() cada vez que haya cambios.
 * @param {Function} onUpdate - Callback que se ejecuta tras actualizar el estado
 */
export function subscribeLists(onUpdate) {
  if (state.listsListener) state.listsListener();

  const q = query(collection(db, COL_LISTS), orderBy('createdAt', 'asc'));

  state.listsListener = onSnapshot(
    q,
    (snap) => {
      state.customLists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOk();
      if (onUpdate) onUpdate();
    },
    (err) => {
      console.error('[listsService] Error en suscripción:', err);
      setError();
    }
  );
}

/**
 * Guarda o actualiza una lista personalizada en Firestore.
 * @param {Object} list - Lista con { id, name, emoji, items, createdAt }
 */
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

/**
 * Elimina una lista personalizada de Firestore.
 * @param {string} id - ID del documento a eliminar
 */
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
