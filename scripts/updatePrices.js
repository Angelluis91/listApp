// Orquestador principal de actualización de precios: lee de Firestore, llama a priceUpdater.js y escribe resultados.
// Ejecutado por GitHub Actions cada lunes a las 6am UTC (ver .github/workflows/update-prices.yml).
import Anthropic               from '@anthropic-ai/sdk';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore }        from 'firebase-admin/firestore';

import {
  fetchMercadonaProducts,
  fetchAlcampoProducts,
  matchPricesWithClaude,
  applyPricesToItems,
} from './priceUpdater.js';

const STRUCTURE_DOC = 'compra_main/structure';
const PRICE_LOG_DOC = 'compra_main/price_log';

// ── Firebase Admin ─────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Iniciando actualización de precios...');
  const startTime = Date.now();

  // 1. Leer items actuales de Firestore
  const structureDoc = await db.doc(STRUCTURE_DOC).get();
  const currentItems = structureDoc.exists ? (structureDoc.data().items || []) : [];
  const itemNames    = [...new Set(currentItems.map(i => i.label).filter(Boolean))];

  if (itemNames.length === 0) {
    console.log('⚠️  No hay items en Firestore. Saliendo.');
    return;
  }
  console.log(`📋 ${itemNames.length} productos en la app`);

  // 2. Obtener catálogos en paralelo (lectura externa, no escritura)
  const [mercadonaResult, alcampoResult] = await Promise.allSettled([
    fetchMercadonaProducts(),
    fetchAlcampoProducts(),
  ]);

  const mercadonaProducts = mercadonaResult.status === 'fulfilled' ? mercadonaResult.value : [];
  const alcampoProducts   = alcampoResult.status   === 'fulfilled' ? alcampoResult.value  : [];
  const mercadonaOk       = mercadonaProducts.length > 0;
  const alcampoOk         = alcampoProducts.length  > 0;

  if (mercadonaOk) {
    console.log(`Mercadona: ${mercadonaProducts.length} productos`);
  } else {
    const err = mercadonaResult.reason;
    console.log(`Mercadona: ERROR — ${err?.message || err || 'desconocido'}`);
    if (err?.stack) console.log(err.stack);
  }
  console.log(`Alcampo:   ${alcampoOk ? alcampoProducts.length + ' productos' : 'sin datos (web dinámica)'}`);

  if (!mercadonaOk) {
    await writeLog({ status: 'error', message: 'No se pudo acceder a Mercadona', updated: 0 });
    process.exit(1);
  }

  // 3. Claude hace el matching semántico (una sola llamada bulk para ahorrar tokens)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const priceMap  = await matchPricesWithClaude(itemNames, mercadonaProducts, alcampoProducts, anthropic);

  // 4. Aplicar precios a los items — nunca sobreescribe si el match falla
  const { updatedItems, updatedCount } = applyPricesToItems(currentItems, priceMap);

  // 5. Persistir la estructura actualizada en Firestore
  await db.doc(STRUCTURE_DOC).update({ items: updatedItems });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ ${updatedCount}/${itemNames.length} precios actualizados en ${elapsed}s`);

  // 6. Guardar log global (para el indicador de sincronización global) y logs por tienda
  const now = new Date().toISOString();
  await writeLog({
    status:  'ok',
    message: `${updatedCount} precios actualizados`,
    updated: updatedCount,
    sources: { mercadona: mercadonaOk, alcampo: alcampoOk },
    // Fecha de última actualización exitosa por tienda — el frontend las lee para el badge
    mercadonaLastUpdated: mercadonaOk ? now : null,
    alcampoLastUpdated:   alcampoOk   ? now : null,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
async function writeLog(data) {
  await db.doc(PRICE_LOG_DOC).set({ ...data, updatedAt: new Date().toISOString() });
}

main().catch(async err => {
  console.error('❌ Error fatal:', err);
  await writeLog({ status: 'error', message: err.message, updated: 0 }).catch(() => {});
  process.exit(1);
});
