import { DomainError } from '../../shared/domain/DomainError';
import { Producto } from '../../producto/domain/Producto';
import { ItemCarrito, type VarianteInfo } from './ItemCarrito';

/**
 * Clave interna para identificar un item (producto + variante o producto solo).
 * Coincide con `ItemCarrito.clave`.
 */
function claveDe(productoId: string, varianteId: string | null | undefined): string {
  return varianteId ? `${productoId}:${varianteId}` : `${productoId}::`;
}

export class Carrito {
  private readonly _items: ItemCarrito[] = [];

  get items(): readonly ItemCarrito[] { return this._items; }
  get vacio(): boolean { return this._items.length === 0; }
  get cantidadItems(): number { return this._items.reduce((a, i) => a + i.cantidad, 0); }
  get subtotal(): number { return this._items.reduce((a, i) => a + i.subtotal, 0); }

  agregar(producto: Producto, cantidad = 1, variante: VarianteInfo | null = null): void {
    const clave = claveDe(producto.id, variante?.id);
    const existente = this._items.find((i) => i.clave === clave);
    if (existente) {
      existente.incrementar(cantidad);
    } else {
      this._items.push(ItemCarrito.create(producto, cantidad, variante));
    }
  }

  quitar(productoId: string, varianteId: string | null = null): void {
    const clave = claveDe(productoId, varianteId);
    const idx = this._items.findIndex((i) => i.clave === clave);
    if (idx === -1) throw new DomainError('Producto no está en el carrito');
    this._items.splice(idx, 1);
  }

  setCantidad(productoId: string, cantidad: number, varianteId: string | null = null): void {
    const clave = claveDe(productoId, varianteId);
    const item = this._items.find((i) => i.clave === clave);
    if (!item) throw new DomainError('Producto no está en el carrito');
    item.setCantidad(cantidad);
  }

  vaciar(): void { this._items.length = 0; }

  /** Calcula el vuelto dado un monto recibido en efectivo. */
  calcularVuelto(montoRecibido: number): number {
    if (montoRecibido < this.subtotal) {
      throw new DomainError('El monto recibido es insuficiente');
    }
    return montoRecibido - this.subtotal;
  }
}
