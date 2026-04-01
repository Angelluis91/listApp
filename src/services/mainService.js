// Operaciones de Firestore para la lista principal: estado de marcado y estructura editable de secciones
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db }          from '../config/firebase.js';
import { state }       from '../state/appState.js';
import { MAIN_DATA }   from '../data/mainData.js';
import { setSyncing, setOk, setError } from '../ui/syncIndicator.js';

const COL_MAIN      = 'compra_main';
const DOC_STATE     = 'state';
const DOC_STRUCTURE = 'structure';

// Suscribe al estado de items marcados (checked/unchecked) y llama a onUpdate al recibir cambios
export function subscribeMain(onUpdate) {
  if (state.mainListener) state.mainListener();

  state.mainListener = onSnapshot(
    doc(db, COL_MAIN, DOC_STATE),
    (snap) => {
      if (snap.exists()) {
        state.mainState = snap.data() || {};
      } else {
        MAIN_DATA.forEach(sec =>
          sec.items.forEach(item => { state.mainState[sec.id + '|' + item] = false; })
        );
      }
      setOk();
      if (onUpdate) onUpdate();
    },
    (err) => { console.error('[mainService] Error en suscripción:', err); setError(); }
  );
}

// Persiste el estado de marcado de la lista principal en Firestore
export async function saveMain() {
  setSyncing();
  try {
    await setDoc(doc(db, COL_MAIN, DOC_STATE), state.mainState);
    setOk();
  } catch (err) {
    console.error('[mainService] Error al guardar estado:', err);
    setError();
  }
}

// Suscribe a la estructura editable (secciones e items) e inicializa desde MAIN_DATA si no existe
export function subscribeStructure(onUpdate) {
  if (state.structureListener) state.structureListener();

  state.structureListener = onSnapshot(
    doc(db, COL_MAIN, DOC_STRUCTURE),
    (snap) => {
      if (snap.exists()) {
        state.mainStructure = snap.data().sections || [];
      } else {
        // Primera vez: copia profunda de MAIN_DATA para que sea mutable
        state.mainStructure = MAIN_DATA.map(sec => ({ ...sec, items: [...sec.items] }));
        saveStructure();
      }
      setOk();
      if (onUpdate) onUpdate();
    },
    (err) => { console.error('[mainService] Error en suscripción de estructura:', err); setError(); }
  );
}

// Persiste la estructura de secciones e items en Firestore
export async function saveStructure() {
  setSyncing();
  try {
    await setDoc(doc(db, COL_MAIN, DOC_STRUCTURE), { sections: state.mainStructure });
    setOk();
  } catch (err) {
    console.error('[mainService] Error al guardar estructura:', err);
    setError();
  }
}
