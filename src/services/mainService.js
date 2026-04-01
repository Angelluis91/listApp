// Operaciones de Firestore para la lista principal de la compra: suscripción en tiempo real y persistencia del estado
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db }          from '../config/firebase.js';
import { state }       from '../state/appState.js';
import { MAIN_DATA }   from '../data/mainData.js';
import { setSyncing, setOk, setError } from '../ui/syncIndicator.js';

const COL_MAIN = 'compra_main';
const DOC_STATE = 'state';

/**
 * Suscribe al documento de estado de la lista principal en Firestore.
 * Llama a onUpdate() cada vez que haya cambios.
 * @param {Function} onUpdate - Callback que se ejecuta tras actualizar el estado
 */
export function subscribeMain(onUpdate) {
  if (state.mainListener) state.mainListener();

  state.mainListener = onSnapshot(
    doc(db, COL_MAIN, DOC_STATE),
    (snap) => {
      if (snap.exists()) {
        state.mainState = snap.data() || {};
      } else {
        // Primera vez: inicializa todo a false
        MAIN_DATA.forEach(sec =>
          sec.items.forEach(item => {
            state.mainState[sec.id + '|' + item] = false;
          })
        );
      }
      setOk();
      if (onUpdate) onUpdate();
    },
    (err) => {
      console.error('[mainService] Error en suscripción:', err);
      setError();
    }
  );
}

/**
 * Persiste el estado actual de la lista principal en Firestore.
 */
export async function saveMain() {
  setSyncing();
  try {
    await setDoc(doc(db, COL_MAIN, DOC_STATE), state.mainState);
    setOk();
  } catch (err) {
    console.error('[mainService] Error al guardar:', err);
    setError();
  }
}
