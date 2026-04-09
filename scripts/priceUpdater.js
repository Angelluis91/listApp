// Funciones de actualización de precios extraídas y exportadas para ser testeables de forma aislada.
// Este módulo NO importa firebase-admin ni inicializa Firebase — eso queda en updatePrices.js.
// El cliente de Anthropic se inyecta como parámetro para facilitar el testing sin SDK real.

const MERCADONA_CATEGORIES_URL = 'https://tienda.mercadona.es/api/categories/';
const ALCAMPO_BASE             = 'https://compraonline.alcampo.es';

// Cabeceras que imitan un navegador real para evitar bloqueos simples
const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/json',
  'Accept-Language': 'es-ES,es;q=0.9',
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Obtiene el catálogo de Mercadona recorriendo su API pública de categorías.
// Devuelve [{ name, price }]. Lanza excepción si falla la petición inicial de categorías.
// Las categorías individuales que fallen se omiten silenciosamente.
export async function fetchMercadonaProducts() {
  let res;
  try {
    res = await fetch(MERCADONA_CATEGORIES_URL, { headers: BROWSER_HEADERS });
  } catch (fetchErr) {
    throw new Error(`Mercadona fetch falló (posible bloqueo de IP): ${fetchErr?.message || String(fetchErr)}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mercadona categories HTTP ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  // La API puede devolver { results: [...] } o directamente un array
  const topCategories = Array.isArray(data.results) ? data.results
                      : Array.isArray(data)          ? data
                      : [];

  if (topCategories.length === 0) {
    throw new Error(`Mercadona: estructura inesperada — keys: ${Array.isArray(data) ? '[array vacío]' : Object.keys(data).join(', ')}`);
  }

  // La API devuelve categorías padre en results[].
  // Los productos están en las SUBCATEGORÍAS: results[].categories[].id
  // Hay que iterar results → categories → fetch por subcat id → extraer productos
  const products = [];

  for (const parentCat of topCategories.slice(0, 26)) {
    const subcats = parentCat.categories || [];
    for (const sub of subcats) {
      try {
        const subRes = await fetch(`${MERCADONA_CATEGORIES_URL}${sub.id}/`, { headers: BROWSER_HEADERS });
        if (!subRes.ok) continue;
        const subData = await subRes.json();
        // La subcategoría puede tener products directamente o agruparlos en sub-subcategorías
        const productLists = subData.categories?.length
          ? subData.categories.map(s => s.products || [])
          : [subData.products || []];
        productLists.forEach(list => {
          list.forEach(p => {
            const price = p.price_instructions?.unit_price ?? p.price_instructions?.bulk_price;
            if (p.display_name && price != null) {
              products.push({ name: p.display_name, price: Number(price) });
            }
          });
        });
        await delay(120); // pausa educada para no sobrecargar la API
      } catch (err) {
        console.warn(`Mercadona: subcat ${sub.id} falló — ${err?.message || String(err)}`);
      }
    }
  }

  return products;
}

// Extrae productos de Alcampo analizando el HTML de páginas de categorías.
// Intenta dos estrategias: __INITIAL_STATE__ (Redux SSR) y JSON-LD (schema.org).
// Devuelve [{ name, price }]. Nunca lanza excepción — devuelve [] si todo falla.
export async function fetchAlcampoProducts() {
  const urls = [
    `${ALCAMPO_BASE}/es/c/alimentacion/lacteos-y-huevos`,
    `${ALCAMPO_BASE}/es/c/alimentacion/panaderia-y-bolleria`,
    `${ALCAMPO_BASE}/es/c/alimentacion/fruta-y-verdura`,
    `${ALCAMPO_BASE}/es/c/alimentacion/carne-y-charcuteria`,
    `${ALCAMPO_BASE}/es/c/drogueria-e-higiene`,
  ];

  const products = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) continue;
      const html = await res.text();

      // Estrategia 1: buscar __INITIAL_STATE__ (Redux SSR)
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
      if (stateMatch) {
        try {
          const reduxState = JSON.parse(stateMatch[1]);
          const items = reduxState?.search?.results?.items
                     || reduxState?.category?.products?.items
                     || [];
          items.forEach(p => {
            const price = p.price?.amount ?? p.price?.value ?? p.salePrice;
            if (p.name && price != null) products.push({ name: p.name, price: Number(price) });
          });
        } catch { /* JSON inválido, continuar con JSON-LD */ }
      }

      // Estrategia 2: bloques JSON-LD (schema.org Product / ItemList)
      const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/g)];
      for (const block of jsonLdBlocks) {
        try {
          const ld      = JSON.parse(block[1]);
          const entries = ld['@type'] === 'ItemList' ? (ld.itemListElement || []) : [ld];
          entries.forEach(e => {
            const item  = e.item || e;
            const price = item.offers?.price ?? item.offers?.lowPrice;
            if (item.name && price != null) products.push({ name: item.name, price: Number(price) });
          });
        } catch { /* continuar con el siguiente bloque */ }
      }

      if (products.length > 10) break; // suficientes datos, no seguir raspando
      await delay(200);
    } catch { /* ignorar URL fallida, continuar con la siguiente */ }
  }

  return products;
}

// Usa Claude para hacer matching semántico entre los productos de la app y los catálogos.
// El anthropicClient se pasa como parámetro para facilitar la inyección en tests.
// Devuelve { [nombreProducto]: { mercadona: number|null, alcampo: number|null } }.
// Lanza excepción si Claude no devuelve JSON válido.
export async function matchPricesWithClaude(itemNames, mercadonaProducts, alcampoProducts, anthropicClient) {
  const formatCatalog = (products, limit = 400) =>
    products.slice(0, limit).map(p => `- ${p.name}: ${p.price.toFixed(2)}€`).join('\n');

  const prompt = `Eres un asistente experto en productos de supermercado español. Tu tarea es asignar precios actuales a los productos de una lista de la compra.

LISTA DE PRODUCTOS DE LA APP (necesito precio para cada uno):
${itemNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

CATÁLOGO MERCADONA (${mercadonaProducts.length} productos):
${formatCatalog(mercadonaProducts)}

${alcampoProducts.length > 0
  ? `CATÁLOGO ALCAMPO (${alcampoProducts.length} productos):\n${formatCatalog(alcampoProducts)}`
  : 'CATÁLOGO ALCAMPO: no disponible esta semana'}

INSTRUCCIONES:
- Para cada producto de la app, encuentra el equivalente más cercano en cada catálogo
- Usa coincidencia semántica (p.ej. "Leche x2" → precio de un brick de leche × 2)
- Si no hay coincidencia razonable, usa null
- Responde ÚNICAMENTE con JSON válido, sin markdown, sin explicación

FORMATO DE RESPUESTA:
{
  "prices": {
    "nombre producto": { "mercadona": 1.25, "alcampo": 1.19 },
    "otro producto":   { "mercadona": null, "alcampo": 0.99 }
  }
}`;

  const response = await anthropicClient.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text       = response.content[0].text.trim();
  // Extraer JSON aunque Claude añada texto alrededor
  const jsonMatch  = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude no devolvió JSON válido');
  return JSON.parse(jsonMatch[0]).prices || {};
}

// Función pura: aplica el mapa de precios a los items y añade campos de estado por item.
// NUNCA sobreescribe el precio existente si no hay match válido (precio null o <= 0).
// Devuelve { updatedItems, updatedCount }.
export function applyPricesToItems(currentItems, priceMap) {
  const now          = new Date().toISOString();
  let   updatedCount = 0;

  const updatedItems = currentItems.map(item => {
    const prices   = priceMap[item.label];
    const newPrice = prices
      ? (item.store === 'mercadona' ? prices.mercadona : prices.alcampo)
      : null;

    if (newPrice != null && newPrice > 0) {
      updatedCount++;
      return {
        ...item,
        price:            Math.round(newPrice * 100) / 100,
        priceStatus:      'ok',
        priceLastUpdated: now,  // solo se actualiza en éxito
        priceLastAttempt: now,
      };
    }

    // Sin match válido: conservar el precio existente, solo actualizar estado
    return {
      ...item,
      priceStatus:      'failed',
      priceLastAttempt: now,
      // priceLastUpdated NO se toca — conserva la fecha del último éxito
    };
  });

  return { updatedItems, updatedCount };
}
