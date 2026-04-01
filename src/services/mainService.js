// Operaciones de Firestore para la lista principal: estado de marcado y estructura de items con tienda y precio
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db }           from '../config/firebase.js';
import { state }        from '../state/appState.js';
import { MAIN_DATA, PRICES, DEFAULT_STORE } from '../data/mainData.js';
import { setSyncing, setOk, setError } from '../ui/syncIndicator.js';

const COL_MAIN      = 'compra_main';
const DOC_STATE     = 'state';
const DOC_STRUCTURE = 'structure';

// Suscribe al estado de items marcados y llama a onUpdate al recibir cambios
export function subscribeMain(onUpdate) {
  if (state.mainListener) state.mainListener();

  state.mainListener = onSnapshot(
    doc(db, COL_MAIN, DOC_STATE),
    (snap) => {
      state.mainState = snap.exists() ? (snap.data() || {}) : {};
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

// Asigna store y price a un item si no los tiene; usa mainState para inferir la tienda en la migración
function enrichItem(item, mainState) {
  const enriched = { ...item };
  if (!enriched.store) {
    // Migración: si estaba marcado → mercadona, si no → alcampo
    enriched.store = mainState[enriched.id] ? 'mercadona' : DEFAULT_STORE;
  }
  if (enriched.price === undefined || enriched.price === null) {
    enriched.price = PRICES[enriched.label] ?? 0;
  }
  return enriched;
}

// Suscribe a la estructura de items; migra formato antiguo de secciones o items sin store/price
export function subscribeStructure(onUpdate) {
  if (state.structureListener) state.structureListener();

  state.structureListener = onSnapshot(
    doc(db, COL_MAIN, DOC_STRUCTURE),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.sections)) {
          // Migración desde formato antiguo con secciones → items planos con store y price
          let idx = 0;
          state.mainStructure = [];
          data.sections.forEach(sec =>
            sec.items.forEach(label => {
              const id = 'item_' + idx++;
              state.mainStructure.push(enrichItem({ id, label }, state.mainState));
            })
          );
          saveStructure();
        } else {
          // Formato nuevo: enriquecer items que aún no tengan store/price
          const items = data.items || [];
          const needsMigration = items.some(i => !i.store || i.price === undefined);
          state.mainStructure = items.map(i => enrichItem(i, state.mainState));
          if (needsMigration) saveStructure();
        }
      } else {
        // Primera vez: aplanar MAIN_DATA con store=alcampo y precio de PRICES
        let idx = 0;
        state.mainStructure = [];
        MAIN_DATA.forEach(sec =>
          sec.items.forEach(label =>
            state.mainStructure.push({ id: 'item_' + idx++, label, store: DEFAULT_STORE, price: PRICES[label] ?? 0 })
          )
        );
        saveStructure();
      }
      setOk();
      if (onUpdate) onUpdate();
    },
    (err) => { console.error('[mainService] Error en suscripción de estructura:', err); setError(); }
  );
}

// Persiste la lista de items con store y price en Firestore
export async function saveStructure() {
  setSyncing();
  try {
    await setDoc(doc(db, COL_MAIN, DOC_STRUCTURE), { items: state.mainStructure });
    setOk();
  } catch (err) {
    console.error('[mainService] Error al guardar estructura:', err);
    setError();
  }
}
