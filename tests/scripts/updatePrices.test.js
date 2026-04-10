// @vitest-environment node
// Tests unitarios para las funciones de actualización de precios.
// Mercadona y Alcampo se testean con fetch mockeado; Claude con cliente inyectado.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchMercadonaProducts,
  fetchAlcampoProducts,
  matchPricesWithClaude,
  applyPricesToItems,
} from '../../scripts/priceUpdater.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

// Crea un objeto Response mínimo compatible con la API de fetch
function mockResponse(body, ok = true, status = 200) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok,
    status,
    json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
    text: () => Promise.resolve(bodyStr),
  };
}

// Construye una respuesta de la API de Consum con los productos indicados
function consumResponse(products, hasMore = false, totalCount = products.length) {
  return {
    totalCount,
    hasMore,
    products: products.map(p => ({
      productData: { name: p.name },
      priceData: {
        prices: Array.isArray(p.prices)
          ? p.prices.map((v, i) => ({ id: i === 0 ? 'PRICE' : 'OFFER_PRICE', value: { centAmount: v } }))
          : [{ id: 'PRICE', value: { centAmount: p.price } }],
      },
    })),
  };
}

// ── Setup global del mock de fetch ─────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ═══════════════════════════════════════════════════════════════════════════════
// MERCADONA
// ═══════════════════════════════════════════════════════════════════════════════
describe('fetchMercadonaProducts', () => {

  it('devuelve productos parseando correctamente nombre y unit_price', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ results: [{ id: 'p1', categories: [{ id: 'sub1' }] }] }))
      .mockResolvedValueOnce(mockResponse({
        categories: [{
          products: [
            { display_name: 'Leche Entera Pascual', price_instructions: { unit_price: '0.95' } },
            { display_name: 'Yogur Natural',        price_instructions: { unit_price: '1.20' } },
          ],
        }],
      }));

    const products = await fetchMercadonaProducts();

    expect(products).toHaveLength(2);
    expect(products[0]).toEqual({ name: 'Leche Entera Pascual', price: 0.95 });
    expect(products[1]).toEqual({ name: 'Yogur Natural',        price: 1.20 });
  });

  it('usa bulk_price cuando unit_price es null', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ results: [{ id: 'p1', categories: [{ id: 'sub1' }] }] }))
      .mockResolvedValueOnce(mockResponse({
        categories: [{
          products: [
            { display_name: 'Aceite Girasol', price_instructions: { unit_price: null, bulk_price: '3.50' } },
          ],
        }],
      }));

    const products = await fetchMercadonaProducts();

    expect(products).toHaveLength(1);
    expect(products[0]).toEqual({ name: 'Aceite Girasol', price: 3.50 });
  });

  it('omite productos sin nombre', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ results: [{ id: 'p1', categories: [{ id: 'sub1' }] }] }))
      .mockResolvedValueOnce(mockResponse({
        categories: [{
          products: [
            { display_name: null,   price_instructions: { unit_price: '0.50' } },
            { display_name: 'Pan', price_instructions: { unit_price: '1.00' } },
          ],
        }],
      }));

    const products = await fetchMercadonaProducts();

    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Pan');
  });

  it('omite productos donde unit_price y bulk_price son ambos null', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ results: [{ id: 'p1', categories: [{ id: 'sub1' }] }] }))
      .mockResolvedValueOnce(mockResponse({
        categories: [{
          products: [
            { display_name: 'Producto Raro', price_instructions: { unit_price: null, bulk_price: null } },
            { display_name: 'Leche',         price_instructions: { unit_price: '0.95' } },
          ],
        }],
      }));

    const products = await fetchMercadonaProducts();

    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Leche');
  });

  it('lanza error si la petición de categorías falla con HTTP error', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, false, 500));

    await expect(fetchMercadonaProducts()).rejects.toThrow('Mercadona categories HTTP 500');
  });

  it('omite una categoría que devuelve HTTP error y continúa con las demás', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ results: [
        { id: 'p1', categories: [{ id: 'sub1' }] },
        { id: 'p2', categories: [{ id: 'sub2' }] },
      ] }))
      .mockResolvedValueOnce(mockResponse({}, false, 503))  // sub1: falla
      .mockResolvedValueOnce(mockResponse({                  // sub2: ok
        categories: [{
          products: [{ display_name: 'Tomate', price_instructions: { unit_price: '0.80' } }],
        }],
      }));

    const products = await fetchMercadonaProducts();

    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Tomate');
  });

  it('devuelve array vacío si todas las categorías fallan pero la petición inicial es ok', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ results: [{ id: '1' }] }))
      .mockRejectedValueOnce(new Error('Network error')); // excepción en categoría

    const products = await fetchMercadonaProducts();

    expect(products).toEqual([]);
  });

  it('parsea subcategorías cuando catData.categories existe', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ results: [{ id: 'p1', categories: [{ id: 'sub1' }] }] }))
      .mockResolvedValueOnce(mockResponse({
        categories: [
          { products: [{ display_name: 'Leche', price_instructions: { unit_price: '0.95' } }] },
          { products: [{ display_name: 'Queso', price_instructions: { unit_price: '2.30' } }] },
        ],
      }));

    const products = await fetchMercadonaProducts();

    expect(products).toHaveLength(2);
    expect(products.map(p => p.name)).toContain('Leche');
    expect(products.map(p => p.name)).toContain('Queso');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALCAMPO (implementado vía Consum — Alcampo no tiene API pública)
// ═══════════════════════════════════════════════════════════════════════════════
describe('fetchAlcampoProducts', () => {

  it('extrae nombre y precio normal de la API de Consum', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(consumResponse([
      { name: 'Leche Semidesnatada Brik', price: 1.25 },
      { name: 'Yogur Natural 4 Ud',       price: 0.89 },
    ])));

    const products = await fetchAlcampoProducts();

    expect(products).toHaveLength(2);
    expect(products[0]).toEqual({ name: 'Leche Semidesnatada Brik', price: 1.25 });
    expect(products[1]).toEqual({ name: 'Yogur Natural 4 Ud',       price: 0.89 });
  });

  it('toma el precio mínimo cuando hay precio normal y precio oferta', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(consumResponse([
      { name: 'Lentejas Bote', prices: [2.35, 1.99] }, // oferta más barata
    ])));

    const products = await fetchAlcampoProducts();

    expect(products[0].price).toBe(1.99);
  });

  it('filtra productos sin nombre', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(consumResponse([
      { name: null,   price: 1.00 },
      { name: 'Pan',  price: 1.00 },
    ])));

    const products = await fetchAlcampoProducts();

    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Pan');
  });

  it('filtra productos con precio 0 o negativo', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(consumResponse([
      { name: 'Producto Raro', price: 0   },
      { name: 'Aceite',        price: 3.5 },
    ])));

    const products = await fetchAlcampoProducts();

    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Aceite');
  });

  it('pagina cuando hasMore es true', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(consumResponse(
        [{ name: 'Leche', price: 1.25 }], true, 200,
      )))
      .mockResolvedValueOnce(mockResponse(consumResponse(
        [{ name: 'Pan',   price: 1.00 }], false, 200,
      )));

    const products = await fetchAlcampoProducts();

    expect(products).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('se detiene cuando hasMore es false sin hacer más requests', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(consumResponse(
      [{ name: 'Leche', price: 1.25 }], false,
    )));

    const products = await fetchAlcampoProducts();

    expect(products).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('devuelve array vacío si la primera petición devuelve HTTP error', async () => {
    mockFetch.mockResolvedValue(mockResponse({}, false, 503));

    const products = await fetchAlcampoProducts();

    expect(products).toEqual([]);
  });

  it('no lanza excepción si fetch falla con error de red', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(fetchAlcampoProducts()).resolves.toEqual([]);
  });

  it('se detiene si el batch devuelto está vacío aunque hasMore sea true', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(consumResponse([{ name: 'Leche', price: 1.25 }], true)))
      .mockResolvedValueOnce(mockResponse(consumResponse([], true)));  // batch vacío

    const products = await fetchAlcampoProducts();

    expect(products).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE MATCHER
// ═══════════════════════════════════════════════════════════════════════════════
describe('matchPricesWithClaude', () => {

  // Cliente mock de Anthropic inyectado como parámetro
  const mockClient = { messages: { create: vi.fn() } };

  beforeEach(() => {
    mockClient.messages.create.mockReset();
  });

  it('devuelve el mapa de precios parseado correctamente', async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ text: JSON.stringify({
        prices: {
          'Leche': { mercadona: 0.95, alcampo: 1.05 },
          'Pan':   { mercadona: 1.20, alcampo: null  },
        },
      })}],
    });

    const result = await matchPricesWithClaude(
      ['Leche', 'Pan'],
      [{ name: 'Leche Entera', price: 0.95 }],
      [{ name: 'Leche Fresca', price: 1.05 }],
      mockClient,
    );

    expect(result['Leche'].mercadona).toBe(0.95);
    expect(result['Leche'].alcampo).toBe(1.05);
    expect(result['Pan'].alcampo).toBeNull();
  });

  it('extrae JSON válido aunque Claude añada texto alrededor', async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ text: `Aquí tienes el resultado:\n${ JSON.stringify({ prices: { 'Leche': { mercadona: 0.95, alcampo: 1.05 } } }) }\n¡Espero que ayude!` }],
    });

    const result = await matchPricesWithClaude(['Leche'], [], [], mockClient);

    expect(result['Leche'].mercadona).toBe(0.95);
  });

  it('lanza error si Claude no devuelve ningún JSON', async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ text: 'Lo siento, no puedo procesar esa solicitud.' }],
    });

    await expect(matchPricesWithClaude(['Leche'], [], [], mockClient))
      .rejects.toThrow('Claude no devolvió JSON válido');
  });

  it('llama a Claude con el modelo haiku correcto', async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ text: '{"prices":{}}' }],
    });

    await matchPricesWithClaude(['Leche'], [], [], mockClient);

    expect(mockClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' })
    );
  });

  it('incluye los nombres de productos en el prompt enviado a Claude', async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ text: '{"prices":{}}' }],
    });

    await matchPricesWithClaude(['Leche Entera', 'Aceite de Oliva'], [], [], mockClient);

    const prompt = mockClient.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Leche Entera');
    expect(prompt).toContain('Aceite de Oliva');
  });

  it('indica en el prompt cuando el catálogo de Alcampo no está disponible', async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ text: '{"prices":{}}' }],
    });

    await matchPricesWithClaude(['Leche'], [{ name: 'Leche', price: 0.95 }], [], mockClient);

    const prompt = mockClient.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('no disponible esta semana');
  });

  it('devuelve objeto vacío si prices no está en la respuesta JSON', async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ text: '{"resultado": "ok"}' }],
    });

    const result = await matchPricesWithClaude(['Leche'], [], [], mockClient);

    expect(result).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPLY PRICES TO ITEMS (función pura, sin mocks)
// ═══════════════════════════════════════════════════════════════════════════════
describe('applyPricesToItems', () => {

  it('actualiza precio y pone priceStatus ok cuando hay match válido para Mercadona', () => {
    const items    = [{ id: '1', label: 'Leche', store: 'mercadona', price: 0 }];
    const priceMap = { 'Leche': { mercadona: 0.95, alcampo: 1.05 } };

    const { updatedItems } = applyPricesToItems(items, priceMap);

    expect(updatedItems[0].price).toBe(0.95);
    expect(updatedItems[0].priceStatus).toBe('ok');
    expect(updatedItems[0].priceLastUpdated).toBeDefined();
    expect(updatedItems[0].priceLastAttempt).toBeDefined();
  });

  it('usa el precio de Alcampo para items asignados a esa tienda', () => {
    const items    = [{ id: '1', label: 'Pan', store: 'alcampo', price: 0 }];
    const priceMap = { 'Pan': { mercadona: 1.20, alcampo: 0.85 } };

    const { updatedItems } = applyPricesToItems(items, priceMap);

    expect(updatedItems[0].price).toBe(0.85);
  });

  it('NO sobreescribe el precio existente cuando no hay match en el mapa', () => {
    const items    = [{ id: '1', label: 'Trufa Negra', store: 'mercadona', price: 45.00 }];
    const priceMap = {};

    const { updatedItems } = applyPricesToItems(items, priceMap);

    expect(updatedItems[0].price).toBe(45.00);          // precio original intacto
    expect(updatedItems[0].priceStatus).toBe('failed');
    expect(updatedItems[0].priceLastAttempt).toBeDefined();
    expect(updatedItems[0].priceLastUpdated).toBeUndefined(); // no se debe tocar
  });

  it('NO sobreescribe el precio cuando el match devuelve null para esa tienda', () => {
    const items    = [{ id: '1', label: 'Leche', store: 'mercadona', price: 2.00 }];
    const priceMap = { 'Leche': { mercadona: null, alcampo: 1.05 } };

    const { updatedItems } = applyPricesToItems(items, priceMap);

    expect(updatedItems[0].price).toBe(2.00);
    expect(updatedItems[0].priceStatus).toBe('failed');
  });

  it('NO sobreescribe el precio cuando el match devuelve 0 o negativo', () => {
    const items    = [{ id: '1', label: 'Leche', store: 'mercadona', price: 1.50 }];
    const priceMap = { 'Leche': { mercadona: 0, alcampo: -1 } };

    const { updatedItems } = applyPricesToItems(items, priceMap);

    expect(updatedItems[0].price).toBe(1.50);
    expect(updatedItems[0].priceStatus).toBe('failed');
  });

  it('redondea precios a 2 decimales', () => {
    const items    = [{ id: '1', label: 'Aceite', store: 'mercadona', price: 0 }];
    const priceMap = { 'Aceite': { mercadona: 3.3333, alcampo: null } };

    const { updatedItems } = applyPricesToItems(items, priceMap);

    expect(updatedItems[0].price).toBe(3.33);
  });

  it('conserva priceLastUpdated anterior en items fallidos', () => {
    const fechaAnterior = '2026-03-01T06:00:00.000Z';
    const items    = [{ id: '1', label: 'Leche', store: 'mercadona', price: 1.00, priceLastUpdated: fechaAnterior }];
    const priceMap = {};

    const { updatedItems } = applyPricesToItems(items, priceMap);

    // priceLastUpdated debe seguir siendo la fecha anterior
    expect(updatedItems[0].priceLastUpdated).toBe(fechaAnterior);
  });

  it('devuelve el conteo correcto de items actualizados', () => {
    const items = [
      { id: '1', label: 'Leche',    store: 'mercadona', price: 0 },
      { id: '2', label: 'Pan',      store: 'alcampo',   price: 0 },
      { id: '3', label: 'Producto Raro', store: 'mercadona', price: 5.00 },
    ];
    const priceMap = {
      'Leche': { mercadona: 0.95, alcampo: null },
      'Pan':   { mercadona: null, alcampo: 0.85 },
      // 'Producto Raro' sin match
    };

    const { updatedCount } = applyPricesToItems(items, priceMap);

    expect(updatedCount).toBe(2);
  });

  it('no muta el array original', () => {
    const items    = [{ id: '1', label: 'Leche', store: 'mercadona', price: 1.00 }];
    const original = JSON.stringify(items);
    const priceMap = { 'Leche': { mercadona: 0.95, alcampo: null } };

    applyPricesToItems(items, priceMap);

    expect(JSON.stringify(items)).toBe(original);
  });

  it('procesa correctamente una lista mixta de éxitos y fallos', () => {
    const items = [
      { id: '1', label: 'Leche',  store: 'mercadona', price: 1.00 },
      { id: '2', label: 'Jamón',  store: 'mercadona', price: 8.00 },
      { id: '3', label: 'Queso',  store: 'alcampo',   price: 3.00 },
    ];
    const priceMap = {
      'Leche': { mercadona: 0.95, alcampo: null },
      // Jamón sin match
      'Queso': { mercadona: 2.50, alcampo: 2.80 },
    };

    const { updatedItems, updatedCount } = applyPricesToItems(items, priceMap);

    expect(updatedCount).toBe(2);
    expect(updatedItems[0].price).toBe(0.95);   // Leche actualizada
    expect(updatedItems[1].price).toBe(8.00);   // Jamón intacto
    expect(updatedItems[2].price).toBe(2.80);   // Queso Alcampo
    expect(updatedItems[0].priceStatus).toBe('ok');
    expect(updatedItems[1].priceStatus).toBe('failed');
    expect(updatedItems[2].priceStatus).toBe('ok');
  });
});
