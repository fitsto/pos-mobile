import { describe, it, expect } from 'vitest';
import { Carrito } from './Carrito';
import { Producto } from '../../producto/domain/Producto';

function mkProducto(id: string, precio: number, oferta: number | null = null) {
  return Producto.create({
    id,
    nombre: `P-${id}`,
    descripcion: null,
    codigoBarras: null,
    sku: null,
    costoNetoUnitario: 0,
    precioVentaFinalUnitario: precio,
    precioVentaNetoUnitario: precio,
    precioOferta: oferta,
    imagenes: [],
    imagenUrl: null,
    activo: true,
  });
}

describe('Carrito', () => {
  it('agrega producto nuevo', () => {
    const c = new Carrito();
    c.agregar(mkProducto('1', 100), 2);
    expect(c.cantidadItems).toBe(2);
    expect(c.subtotal).toBe(200);
  });

  it('incrementa cantidad si el producto ya está en el carrito', () => {
    const c = new Carrito();
    const p = mkProducto('1', 100);
    c.agregar(p, 1);
    c.agregar(p, 2);
    expect(c.items).toHaveLength(1);
    expect(c.items[0].cantidad).toBe(3);
    expect(c.subtotal).toBe(300);
  });

  it('usa precio de oferta cuando existe', () => {
    const c = new Carrito();
    c.agregar(mkProducto('1', 100, 80), 2);
    expect(c.subtotal).toBe(160);
  });

  it('quita producto', () => {
    const c = new Carrito();
    c.agregar(mkProducto('1', 100), 1);
    c.agregar(mkProducto('2', 50), 1);
    c.quitar('1');
    expect(c.items).toHaveLength(1);
    expect(c.subtotal).toBe(50);
  });

  it('setCantidad cambia la cantidad del item', () => {
    const c = new Carrito();
    c.agregar(mkProducto('1', 100), 1);
    c.setCantidad('1', 5);
    expect(c.subtotal).toBe(500);
  });

  it('rechaza cantidad cero o negativa', () => {
    const c = new Carrito();
    c.agregar(mkProducto('1', 100), 1);
    expect(() => c.setCantidad('1', 0)).toThrow();
    expect(() => c.setCantidad('1', -1)).toThrow();
  });

  it('calcula vuelto correctamente', () => {
    const c = new Carrito();
    c.agregar(mkProducto('1', 100), 3);
    expect(c.calcularVuelto(500)).toBe(200);
  });

  it('rechaza vuelto cuando el monto recibido es insuficiente', () => {
    const c = new Carrito();
    c.agregar(mkProducto('1', 100), 3);
    expect(() => c.calcularVuelto(299)).toThrow('insuficiente');
  });

  it('carrito vacío reporta subtotal 0', () => {
    const c = new Carrito();
    expect(c.vacio).toBe(true);
    expect(c.subtotal).toBe(0);
  });
});
