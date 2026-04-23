import { describe, it, expect } from 'vitest';
import { Tienda } from './Tienda';

describe('Tienda', () => {
  it('admin no necesita ubicación', () => {
    const n = Tienda.create({ id: 'n', nombre: 'X', rol: 'ADMIN', ubicacionId: null, ubicacionNombre: null, usarControlCaja: false });
    expect(n.puedeGestionarStock).toBe(true);
    expect(n.esVendedor).toBe(false);
  });

  it('vendedor requiere ubicación', () => {
    expect(() =>
      Tienda.create({ id: 'n', nombre: 'X', rol: 'VENDEDOR', ubicacionId: null, ubicacionNombre: null, usarControlCaja: false }),
    ).toThrow(/ubicación/);
  });

  it('vendedor no puede gestionar stock', () => {
    const n = Tienda.create({ id: 'n', nombre: 'X', rol: 'VENDEDOR', ubicacionId: 'u1', ubicacionNombre: 'Central', usarControlCaja: false });
    expect(n.esVendedor).toBe(true);
    expect(n.puedeGestionarStock).toBe(false);
  });

  it('gerente puede gestionar stock', () => {
    const n = Tienda.create({ id: 'n', nombre: 'X', rol: 'GERENTE', ubicacionId: null, ubicacionNombre: null, usarControlCaja: false });
    expect(n.puedeGestionarStock).toBe(true);
  });
});
