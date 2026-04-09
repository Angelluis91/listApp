// Tests unitarios para priceService: suscripción al log de actualización de precios en Firestore
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockOnSnapshot, mockDoc } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockDoc:        vi.fn(() => ({})),
}));

vi.mock('../../src/config/firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc:        mockDoc,
  onSnapshot: mockOnSnapshot,
}));
vi.mock('../../src/ui/priceIndicator.js', () => ({
  showPriceStatus: vi.fn(),
}));

import { subscribePriceLog }   from '../../src/services/priceService.js';
import { showPriceStatus }     from '../../src/ui/priceIndicator.js';

describe('priceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
  });

  it('llama a onSnapshot una vez al suscribirse', () => {
    subscribePriceLog();
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('llama a showPriceStatus cuando el snapshot existe con status ok', () => {
    const data = { status: 'ok', message: '10 precios actualizados', updatedAt: '2026-04-01T06:00:00Z', updated: 10 };
    mockOnSnapshot.mockImplementation((ref, cb) => { cb({ exists: () => true, data: () => data }); return vi.fn(); });

    subscribePriceLog();

    expect(showPriceStatus).toHaveBeenCalledWith(data);
  });

  it('llama a showPriceStatus cuando el snapshot existe con status error', () => {
    const data = { status: 'error', message: 'No se pudo acceder a Mercadona', updated: 0 };
    mockOnSnapshot.mockImplementation((ref, cb) => { cb({ exists: () => true, data: () => data }); return vi.fn(); });

    subscribePriceLog();

    expect(showPriceStatus).toHaveBeenCalledWith(data);
  });

  it('no llama a showPriceStatus cuando el snapshot no existe', () => {
    mockOnSnapshot.mockImplementation((ref, cb) => { cb({ exists: () => false }); return vi.fn(); });

    subscribePriceLog();

    expect(showPriceStatus).not.toHaveBeenCalled();
  });

  it('ignora errores de Firestore silenciosamente sin lanzar excepción', () => {
    mockOnSnapshot.mockImplementation((ref, _cb, errCb) => { errCb(new Error('network')); return vi.fn(); });

    expect(() => subscribePriceLog()).not.toThrow();
  });
});
