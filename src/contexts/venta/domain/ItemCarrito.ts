import { DomainError } from '../../shared/domain/DomainError';
import { Producto } from '../../producto/domain/Producto';

/**
 * Info de variante cuando el item del carrito corresponde a una variante concreta
 * (modelo + talla) de un producto con variantes activas.
 */
export interface VarianteInfo {
  id: string;
  modeloNombre: string | null;
  talla: string | null;
  /** Precio final de la variante si hay override; null → usar precio del producto. */
  precioVentaFinal: number | null;
}

export class ItemCarrito {
  private constructor(
    public readonly producto: Producto,
    private _cantidad: number,
    public readonly variante: VarianteInfo | null = null,
  ) {}

  static create(producto: Producto, cantidad: number, variante: VarianteInfo | null = null): ItemCarrito {
    if (cantidad <= 0) throw new DomainError('La cantidad debe ser mayor a cero');
    if (!Number.isInteger(cantidad)) throw new DomainError('La cantidad debe ser entera');
    return new ItemCarrito(producto, cantidad, variante);
  }

  get cantidad(): number { return this._cantidad; }
  get precioUnitario(): number {
    return this.variante?.precioVentaFinal ?? this.producto.precio;
  }
  get subtotal(): number { return this.precioUnitario * this._cantidad; }

  /** Clave única para deduplicar items (producto + variante). */
  get clave(): string {
    return this.variante ? `${this.producto.id}:${this.variante.id}` : `${this.producto.id}::`;
  }

  /** Etiqueta corta del variante: "Modelo · Talla" (omite partes nulas). */
  get varianteLabel(): string | null {
    if (!this.variante) return null;
    const parts: string[] = [];
    if (this.variante.modeloNombre) parts.push(this.variante.modeloNombre);
    if (this.variante.talla) parts.push(this.variante.talla);
    return parts.length ? parts.join(' · ') : null;
  }

  incrementar(delta = 1): void {
    const next = this._cantidad + delta;
    if (next <= 0) throw new DomainError('La cantidad debe ser mayor a cero');
    this._cantidad = next;
  }

  setCantidad(cantidad: number): void {
    if (cantidad <= 0) throw new DomainError('La cantidad debe ser mayor a cero');
    if (!Number.isInteger(cantidad)) throw new DomainError('La cantidad debe ser entera');
    this._cantidad = cantidad;
  }
}
