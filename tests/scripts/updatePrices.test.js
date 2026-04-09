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

// Genera una respuesta HTML con __INITIAL_STATE__ de Alcampo
function htmlWithInitialState(state) {
  return `<html><body>
    <script>window.__INITIAL_STATE__ = ${JSON.stringify(state)};
    </script></body></html>`;
}

// Genera una respuesta HTML con un bloque JSON-LD
function htmlWithJsonLd(jsonLd) {
  return `<html><body>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    </body></html>`;
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
      .mockResolvedValueOnce(mockResponse({ results: [{ id: '1' }] }))
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
      .mockResolvedValueOnce(mockResponse({ results: [{ id: '1' }] }))
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
      .mockResolvedValueOnce(mockResponse({ results: [{ id: '1' }] }))
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
      .mockResolvedValueOnce(mockResponse({ results: [{ id: '1' }] }))
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
      .mockResolvedValueOnce(mockResponse({ results: [{ id: '1' }, { id: '2' }] }))
      .mockResolvedValueOnce(mockResponse({}, false, 503))  // cat 1: falla
      .mockResolvedValueOnce(mockResponse({                  // cat 2: ok
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
      .mockResolvedValueOnce(mockResponse({ results: [{ id: '1' }] }))
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
// ALCAMPO
// ═══════════════════════════════════════════════════════════════════════════════
describe('fetchAlcampoProducts', () => {

  it('extrae productos del bloque __INITIAL_STATE__ con estructura search.results.items', async () => {
    const initialState = {
      search: { results: { items: [
        { name: 'Leche Entera 1L',  price: { amount: 1.05 } },
        { name: 'Mantequilla 250g', price: { amount: 2.30 } },
      ]}},
    };
    mockFetch.mockResolvedValueOnce(mockResponse(htmlWithInitialState(initialState)));

    const products = await fetchAlcampoProducts();

    expect(products.find(p => p.name === 'Leche Entera 1L')).toBeDefined();
    expect(products.find(p => p.name === 'Leche Entera 1L').price).toBe(1.05);
    expect(products.find(p => p.name === 'Mantequilla 250g').price).toBe(2.30);
  });

  it('extrae productos del bloque __INITIAL_STATE__ con estructura category.products.items', async () => {
    const initialState = {
      category: { products: { items: [
        { name: 'Yogur Natural 500g', price: { value: 0.89 } },
      ]}},
    };
    mockFetch.mockResolvedValueOnce(mockResponse(htmlWithInitialState(initialState)));

    const products = await fetchAlcampoProducts();

    expect(products.find(p => p.name === 'Yogur Natural 500g')).toBeDefined();
  });

  it('extrae productos de JSON-LD de tipo Product con offers.price', async () => {
    const jsonLd = { '@type': 'Product', name: 'Arroz SOS 1kg', offers: { price: 1.50 } };
    mockFetch.mockResolvedValueOnce(mockResponse(htmlWithJsonLd(jsonLd)));

    const products = await fetchAlcampoProducts();

    expect(products.find(p => p.name === 'Arroz SOS 1kg')).toBeDefined();
    expect(products.find(p => p.name === 'Arroz SOS 1kg').price).toBe(1.50);
  });

  it('extrae productos de JSON-LD de tipo ItemList', async () => {
    const jsonLd = {
      '@type': 'ItemList',
      itemListElement: [
        { item: { name: 'Pan Molde',  offers: { price: 1.25 } } },
        { item: { name: 'Baguette',   offers: { price: 0.75 } } },
      ],
    };
    mockFetch.mockResolvedValueOnce(mockResponse(htmlWithJsonLd(jsonLd)));

    const products = await fetchAlcampoProducts();

    expect(products.find(p => p.name === 'Pan Molde')).toBeDefined();
    expect(products.find(p => p.name === 'Baguette')).toBeDefined();
  });

  it('usa offers.lowPrice si offers.price no existe en JSON-LD', async () => {
    const jsonLd = { '@type': 'Product', name: 'Aceite Oliva', offers: { lowPrice: 4.99 } };
    mockFetch.mockResolvedValueOnce(mockResponse(htmlWithJsonLd(jsonLd)));

    const products = await fetchAlcampoProducts();

    expect(products.find(p => p.name === 'Aceite Oliva').price).toBe(4.99);
  });

  it('devuelve array vacío si todas las URLs devuelven HTTP error', async () => {
    mockFetch.mockResolvedValue(mockResponse({}, false, 503));

    const products = await fetchAlcampoProducts();

    expect(products).toEqual([]);
  });

  it('no lanza excepción si fetch falla con error de red', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(fetchAlcampoProducts()).resolves.toEqual([]);
  });

  it('ignora __INITIAL_STATE__ con JSON inválido y sigue con JSON-LD', async () => {
    const jsonLd = { '@type': 'Product', name: 'Pasta Barilla', offers: { price: 1.89 } };
    const html = `<html><body>
      <script>window.__INITIAL_STATE__ = {esto no es json válido;
      </script>
      <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
      </body></html>`;
    mockFetch.mockResolvedValueOnce(mockResponse(html));

    const products = await fetchAlcampoProducts();

    expect(products.find(p => p.name === 'Pasta Barilla')).toBeDefined();
  });

  it('se detiene al superar 10 productos sin recorrer todas las URLs', async () => {
    // Primera URL devuelve 11 productos → no debe hacer más requests
    const initialState = {
      search: { results: { items: Array.from({ length: 11 }, (_, i) => ({
        name: `Producto ${i + 1}`, price: { amount: i + 1 },
      })) }},
    };
    mockFetch.mockResolvedValueOnce(mockResponse(htmlWithInitialState(initialState)));

    const products = await fetchAlcampoProducts();

    expect(products.length).toBeGreaterThanOrEqual(11);
    // Solo se hizo 1 petición
    expect(mockFetch).toHaveBeenCalledTimes(1);
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
