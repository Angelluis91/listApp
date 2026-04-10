// Funciones de actualización de precios extraídas y exportadas para ser testeables de forma aislada.
// Este módulo NO importa firebase-admin ni inicializa Firebase — eso queda en updatePrices.js.
// El cliente de Anthropic se inyecta como parámetro para facilitar el testing sin SDK real.

const MERCADONA_CATEGORIES_URL = 'https://tienda.mercadona.es/api/categories/';

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

// Obtiene precios de referencia para items de Alcampo usando la API pública de Consum.
// Alcampo no expone API accesible (SPA sin SSR, endpoints bloqueados). Consum usa la misma
// gama de productos del mercado español con precios muy similares.
// Devuelve [{ name, price }]. Nunca lanza excepción — devuelve [] si todo falla.
export async function fetchAlcampoProducts() {
  const products = [];
  const LIMIT    = 100;
  const MAX_ITEMS = 1200;
  const BASE_URL = 'https://tienda.consum.es/api/rest/V1.0/catalog/product';

  for (let start = 0; start < MAX_ITEMS; start += LIMIT) {
    try {
      const url = `${BASE_URL}?userType=1&languageId=1&limit=${LIMIT}&start=${start}`;
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        console.warn(`Consum (ref. Alcampo) pág ${Math.floor(start / LIMIT) + 1} HTTP ${res.status}`);
        break;
      }
      const data  = await res.json();
      const batch = data.products || [];

      batch.forEach(p => {
        const name   = p.productData?.name;
        // prices[0] = precio normal, prices[1] = precio oferta si existe — tomamos el más bajo
        const prices = (p.priceData?.prices || [])
          .map(pr => pr.value?.centAmount)
          .filter(v => v != null && v > 0);
        const price = prices.length ? Math.min(...prices) : null;
        if (name && price != null) {
          products.push({ name, price });
        }
      });

      if (!data.hasMore || batch.length === 0) break;
      await delay(120);
    } catch (err) {
      console.warn(`Consum (ref. Alcampo) start=${start}: ${err?.message || String(err)}`);
      break;
    }
  }

  if (products.length === 0) {
    console.log('Consum (ref. Alcampo): sin datos — los precios de Alcampo no se actualizarán');
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

  const prompt = `Eres un experto en compras de supermercado español. Tienes que asignar un precio a cada producto de una lista de la compra buscando el equivalente más cercano en los catálogos de Mercadona y Alcampo.

REGLAS CRÍTICAS PARA EL MATCHING:
1. Los nombres de la lista son COLOQUIALES y ABREVIADOS, no nombres de producto exactos. Siempre hay un equivalente.
2. Barras "/" significan "o cualquiera de estos": "Queso rayado/polvo" → busca queso rallado o queso en polvo
3. Cantidades: "Leche x2" → precio de 1 unidad de leche × 2. "x2", "x3" etc. multiplica el precio unitario
4. Nombres genéricos: "Jamón" → jamón cocido en lonchas (el más barato). "Queso" → queso en lonchas básico
5. Marcas propias: usa siempre la marca blanca más barata si existe (Hacendado en Mercadona)
6. Productos de limpieza/higiene sin marca: busca el equivalente genérico más cercano
7. NUNCA pongas null si existe algo remotamente parecido en el catálogo. Solo null si es un producto absolutamente inexistente (ej: medicamentos de prescripción)

EJEMPLOS DE MATCHING CORRECTO:
- "Leche x2" → precio leche 1L × 2 = ~1.90€
- "Croquetas/palitos queso/nuggets" → busca croquetas (el más barato del catálogo)
- "Queso rayado/polvo" → queso rallado o parmesano en polvo
- "Sal/gorda" → sal de mesa o sal gruesa
- "Cilantro/cebollino/albahaca" → cualquier hierba fresca de las mencionadas
- "Picoteo trabajo" → patatas fritas o snack pequeño
- "Comida perritas" → comida para perros húmeda o pienso pequeño
- "Vitamina C" → vitamina C en pastillas o sobres
- "Trapo amarillo/polvo/cristales/baño" → bayeta multiusos
- "Pestosin baño/salón" → spray limpiador multiusos
- "Productos pelo" → champú o acondicionador básico

LISTA DE LA COMPRA (${itemNames.length} productos, necesito precio para TODOS):
${itemNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

CATÁLOGO MERCADONA (${mercadonaProducts.length} productos disponibles):
${formatCatalog(mercadonaProducts)}

${alcampoProducts.length > 0
  ? `CATÁLOGO ALCAMPO (${alcampoProducts.length} productos disponibles):\n${formatCatalog(alcampoProducts)}`
  : 'CATÁLOGO ALCAMPO: no disponible esta semana — pon null para todos los precios de alcampo'}

FORMATO DE RESPUESTA (JSON puro, sin markdown, sin texto adicional):
{
  "prices": {
    "nombre exacto del producto": { "mercadona": 1.25, "alcampo": 1.19 },
    "otro producto": { "mercadona": 0.95, "alcampo": null }
  }
}

IMPORTANTE: El JSON debe tener exactamente ${itemNames.length} entradas, una por cada producto de la lista. Los nombres deben ser exactamente iguales a los de la lista.`;

  const response = await anthropicClient.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 8192, // 166 productos × ~30 tokens por entrada ≈ 5000 tokens de respuesta
    messages:   [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();

  // Verificar si la respuesta fue cortada por el límite de tokens
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Claude cortó la respuesta por max_tokens — aumentar límite o reducir productos');
  }

  // Extraer JSON aunque Claude añada texto alrededor
  const jsonMatch = text.match(/\{[\s\S]*\}/);
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
