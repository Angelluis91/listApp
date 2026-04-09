// Suscripción en tiempo real al log de actualización de precios en Firestore
import { doc, onSnapshot } from 'firebase/firestore';
import { db }              from '../config/firebase.js';
import { showPriceStatus } from '../ui/priceIndicator.js';

const PRICE_LOG_DOC = 'compra_main/price_log';

// Escucha cambios en el documento de log de precios y actualiza el indicador visual
export function subscribePriceLog() {
  onSnapshot(
    doc(db, PRICE_LOG_DOC),
    snap => { if (snap.exists()) showPriceStatus(snap.data()); },
    () => { /* errores de Firestore se ignoran silenciosamente */ },
  );
}
