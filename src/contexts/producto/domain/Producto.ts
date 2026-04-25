export interface ProductoImagen {
  id: string;
  url: string;
}

export interface ProductoData {
  id: string;
  nombre: string;
  descripcion: string | null;
  codigoBarras: string | null;
  sku: string | null;
  costoNetoUnitario: number;
  precioVentaFinalUnitario: number;
  precioVentaNetoUnitario: number;
  precioOferta: number | null;
  imagenes: ProductoImagen[];
  imagenUrl: string | null;
  activo: boolean;
  /**
   * Suma de stock en todas las ubicaciones (incluye variantes). null/ausente
   * cuando el endpoint no la entrega (ej: detalle). En listado siempre llega.
   */
  stockTotal?: number | null;
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
  get descripcion(): string | null { return this.data.descripcion; }
  get codigoBarras(): string | null { return this.data.codigoBarras; }
  get sku(): string | null { return this.data.sku; }
  get imagenUrl(): string | null { return this.data.imagenUrl; }
  get imagenes(): ProductoImagen[] { return this.data.imagenes; }
  get activo(): boolean { return this.data.activo; }
  get costoNetoUnitario(): number { return this.data.costoNetoUnitario; }
  get precioVentaFinalUnitario(): number { return this.data.precioVentaFinalUnitario; }
  get precioVentaNetoUnitario(): number { return this.data.precioVentaNetoUnitario; }
  get precioOferta(): number | null { return this.data.precioOferta; }
  get stockTotal(): number | null { return this.data.stockTotal ?? null; }

  /** Precio efectivo: oferta si existe, sino precio normal. */
  get precio(): number {
    return this.data.precioOferta ?? this.data.precioVentaFinalUnitario;
  }

  get tieneOferta(): boolean {
    return this.data.precioOferta !== null;
  }

  toJSON(): ProductoData { return { ...this.data }; }
}
