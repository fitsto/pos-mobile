/**
 * Snapshot devuelto por `GET /tiendas/:organizationId/catalogo`.
 * Si se llama sin `since`, es un snapshot inicial (reemplazo total).
 * Con `since` es un diff incremental (merge por id en productos/variantes/modelos/stock).
 * `categorias` y `marcas` siempre llegan completas.
 */

export interface CatalogoConfig {
  impuestoVentaPorcentaje: number;
  moneda: string;
  permitirVentaSinStock: boolean;
  usarControlCaja: boolean;
}

export interface CatalogoProducto {
  id: string;
  organizationId: string;
  categoriaId: string | null;
  marcaId: string | null;
  nombre: string;
  codigoInterno: string | null;
  codigoBarra: string | null;
  costoNeto: number | null;
  precioVentaFinal: number;
  precioVentaNeto: number | null;
  precioOferta: number | null;
  tipo: string;
  activo: boolean;
  usaVariantes: boolean;
  /** Primera imagen del producto — para mostrar en el POS sin pegar al detalle. */
  imagenUrl: string | null;
  updatedAt: string;
}

export interface CatalogoVariante {
  id: string;
  productoId: string;
  modeloId: string | null;
  talla: string | null;
  sku: string | null;
  codigoBarra: string | null;
  precioVentaFinal: number | null;
  precioVentaNeto: number | null;
  costoNeto: number | null;
  activo: boolean;
  orden: number;
  updatedAt: string;
}

export interface CatalogoModelo {
  id: string;
  productoId: string;
  nombre: string;
  imagenUrl: string | null;
  orden: number;
  activo: boolean;
  updatedAt: string;
}

export interface CatalogoCategoria {
  id: string;
  nombre: string;
}

export interface CatalogoMarca {
  id: string;
  nombre: string;
}

export interface CatalogoStock {
  productoId: string;
  varianteId: string | null;
  ubicacionId: string;
  cantidad: number;
  updatedAt: string;
}

export interface CatalogoSnapshot {
  serverTime: string;
  esSnapshotInicial: boolean;
  config: CatalogoConfig;
  productos: CatalogoProducto[];
  variantes: CatalogoVariante[];
  modelos: CatalogoModelo[];
  categorias: CatalogoCategoria[];
  marcas: CatalogoMarca[];
  stock: CatalogoStock[];
}
