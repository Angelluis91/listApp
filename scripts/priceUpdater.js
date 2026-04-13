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
// Alcampo no expone API accesible (SPA sin SSR, todos los endpoints bloqueados/404).
// Consum tiene API pública con 9170 productos y precios reales del mercado español.
// Usamos búsquedas dirigidas por categoría para cubrir TODAS las secciones de la lista,
// evitando que la paginación genérica solo devuelva frutas y verduras.
// Devuelve [{ name, price }]. Nunca lanza excepción — devuelve [] si todo falla.
export async function fetchAlcampoProducts() {
  const seen     = new Set();
  const products = [];

  // Términos ordenados: categorías con mayor tasa de fallos primero
  // para que queden en los primeros 700 productos enviados a Claude
  const SEARCH_TERMS = [
    // Limpieza y hogar (mayor tasa de fallos)
    'limpiador', 'lejia', 'lavavajillas', 'detergente', 'suavizante',
    // Papel e higiene
    'papel', 'servilleta', 'champu', 'gel', 'desodorante', 'compresas',
    // Mascotas
    'pienso',
    // Condimentos y salsas (muchos fallos)
    'sal', 'azucar', 'pimienta', 'oregano', 'vinagre', 'aceite', 'ketchup', 'mayonesa',
    // Conservas
    'atun', 'conserva',
    // Legumbres y secos
    'garbanzo', 'lenteja', 'pasta', 'arroz', 'harina',
    // Pan y repostería
    'pan', 'levadura', 'chocolate', 'galleta', 'miel', 'mermelada',
    // Bebidas calientes
    'cafe', 'manzanilla',
    // Verduras variadas
    'zanahoria', 'espinaca', 'champiñon', 'guisante',
    // Frutas variadas
    'limon', 'arandano', 'manzana',
    // Lácteos y carnes (ya tienen buen matching pero completar)
    'leche', 'yogur', 'queso', 'pollo', 'carne', 'jamon',
  ];

  for (const term of SEARCH_TERMS) {
    try {
      const url = `https://tienda.consum.es/api/rest/V1.0/catalog/product?userType=1&languageId=1&limit=50&start=0&query=${encodeURIComponent(term)}`;
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        console.warn(`Consum (ref. Alcampo) "${term}" HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();

      (data.products || []).forEach(p => {
        const name = p.productData?.name;
        // Tomamos el precio más bajo (normal o oferta)
        const prices = (p.priceData?.prices || [])
          .map(pr => pr.value?.centAmount)
          .filter(v => v != null && v > 0);
        const price = prices.length ? Math.min(...prices) : null;
        if (name && price != null && !seen.has(name)) {
          seen.add(name);
          products.push({ name, price });
        }
      });

      await delay(100);
    } catch (err) {
      console.warn(`Consum (ref. Alcampo) "${term}": ${err?.message || String(err)}`);
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

  const prompt = `Eres un experto en compras de supermercado español. Tienes que asignar un precio a cada producto de una lista de la compra buscando el equivalente más cercano en los catálogos.

CONTEXTO IMPORTANTE:
- El catálogo de Mercadona usa nombres de marca (Hacendado, etc.)
- El catálogo de Alcampo está extraído de Consum, que usa nombres FORMALES y DESCRIPTIVOS:
  "Papel Higiénico 4 Rollos", "Detergente Líquido Botella", "Champu Anticaspa Bote"
  Debes hacer matching semántico, no textual.

REGLAS DE MATCHING (obligatorias):
1. Nombres COLOQUIALES → busca el equivalente formal en el catálogo
   "papel baño" → "Papel Higiénico", "champu" → "Champú", "sal" → "Sal Fina" o "Sal Mesa"
2. "/" significa "cualquiera de estos": "sal/gorda" → sal fina o sal gruesa (el más barato)
3. "xN" multiplica: "Leche x2" → precio unitario leche × 2
4. Genéricos → marca blanca más barata: "jamón" → jamón cocido lonchas barato
5. Limpieza/higiene → busca el nombre genérico del producto aunque el formato difiera
6. Mascotas: "comida perritas" → pienso seco o comida húmeda para perros
7. NUNCA null si hay algo remotamente parecido. Solo null para productos inexistentes en supermercados (medicamentos de prescripción, etc.)

TABLA DE EQUIVALENCIAS COLOQUIAL → FORMAL (usa esto como guía):
- "papel baño/cocina/pañuelos/servilletas" → "Papel Higiénico / Papel Cocina / Pañuelos / Servilletas"
- "champu/gel/desodorante/compresas/tampones" → busca esas palabras en el catálogo formal
- "sal / pimienta / oregano / perejil / canela / comino / pimenton" → especias en polvo o enteras
- "azucar/moreno" → "Azúcar Blanca" o "Azúcar Moreno"
- "aceite oliva/girasol" → "Aceite de Oliva / Aceite de Girasol Botella"
- "ketchup / mayonesa / vinagre / mermelada / miel" → bote o botella estándar
- "atun / maiz / guisantes / aceitunas" → lata o bote de conserva
- "pasta corta/spaguetti/fideos/noodles" → pasta seca (el formato más barato)
- "garbanzos/judias/lentejas" → legumbre cocida en bote (la más barata)
- "harina/maicena/levadura/pan rallado" → paquete estándar
- "chocolate negro" → tableta chocolate negro
- "galletas/cereales" → paquete básico
- "anacardos/nueces/cacahuetes" → bolsa de frutos secos
- "lavavajillas/detergente/suavizante/lejia" → formato botella estándar
- "bolsas basura 10L/30L" → rollo bolsas del tamaño indicado
- "bolsas zip/papel film/aluminio/horno" → caja estándar
- "estropajo/trapo/bayeta" → pack de estropajos o bayeta
- "limpiador/quita grasas/limpia cristales/friega suelos" → spray o botella limpiador
- "cillit bang/mokito/pronto/ambientador" → el producto más cercano por función
- "desmaquillante/discos algodón/acetona" → formato bote o paquete estándar
- "seda dental/enjuague bucal/suero fisiológico/tiritas" → producto higiene/farmacia
- "vitamina C" → complemento vitamínico en sobres o pastillas
- "picoteo trabajo" → patatas fritas o snack pequeño
- "comida/premio/palitos/bolsa perritas" → producto para perros (pienso, snack, bolsas)

LISTA DE LA COMPRA (${itemNames.length} productos, necesito precio para TODOS):
${itemNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

CATÁLOGO MERCADONA (${mercadonaProducts.length} productos):
${formatCatalog(mercadonaProducts)}

${alcampoProducts.length > 0
  ? `CATÁLOGO ALCAMPO/CONSUM (${alcampoProducts.length} productos, nombres formales):\n${formatCatalog(alcampoProducts, 700)}`
  : 'CATÁLOGO ALCAMPO: no disponible esta semana — pon null para todos los precios de alcampo'}

FORMATO DE RESPUESTA (JSON puro, sin markdown, sin texto adicional):
{
  "prices": {
    "nombre exacto del producto": { "mercadona": 1.25, "alcampo": 1.19 },
    "otro producto": { "mercadona": 0.95, "alcampo": null }
  }
}

IMPORTANTE: El JSON debe tener exactamente ${itemNames.length} entradas. Los nombres deben ser exactamente iguales a los de la lista.`;

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
