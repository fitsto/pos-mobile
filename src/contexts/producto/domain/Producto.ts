export interface ProductoData {
  id: string;
  nombre: string;
  codigoBarras: string | null;
  sku: string | null;
  precioVentaFinalUnitario: number;
  precioOferta: number | null;
  imagenUrl: string | null;
  activo: boolean;
}

export class Producto {
  private constructor(private readonly data: ProductoData) {}

  static create(data: ProductoData): Producto {
    if (!data.id) throw new Error('Producto requiere id');
    if (data.precioVentaFinalUnitario < 0) {
      throw new Error('Precio no puede ser negativo');
    }
    return new Producto(data);
  }

  get id(): string { return this.data.id; }
  get nombre(): string { return this.data.nombre; }
  get codigoBarras(): string | null { return this.data.codigoBarras; }
  get sku(): string | null { return this.data.sku; }
  get imagenUrl(): string | null { return this.data.imagenUrl; }
  get activo(): boolean { return this.data.activo; }

  /** Precio efectivo: oferta si existe, sino precio normal. */
  get precio(): number {
    return this.data.precioOferta ?? this.data.precioVentaFinalUnitario;
  }

  get tieneOferta(): boolean {
    return this.data.precioOferta !== null;
  }

  toJSON(): ProductoData { return { ...this.data }; }
}
