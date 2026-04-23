export interface Variante {
  id: string;
  productoId: string;
  modeloId: string | null;
  talla: string | null;
  sku: string | null;
  codigoBarra: string | null;
  costoNeto: number | null;
  /** Precio final override de la variante; si es null, se usa el del producto. */
  precioVentaFinal: number | null;
  precioVentaNeto: number | null;
  orden: number;
  activo: boolean;
}

export interface Modelo {
  id: string;
  nombre: string;
  imagenUrl: string | null;
  orden: number;
  activo: boolean;
}
