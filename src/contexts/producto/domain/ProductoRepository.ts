import type { Producto } from './Producto';

export interface BuscarProductoParams {
  negocioId: string;
  query: string;
  token: string;
  /** Si se pasa, solo devuelve productos con stock > 0 en esa ubicación. */
  ubicacionId?: string;
  /** Si es true, incluye productos desactivados (soft-deleted). */
  incluirInactivos?: boolean;
}

export interface ObtenerProductoParams {
  negocioId: string;
  productoId: string;
  token: string;
}

export interface CrearProductoInput {
  negocioId: string;
  token: string;
  nombre: string;
  precioVentaFinalUnitario: number;
  costoNetoUnitario?: number;
  categoriaId?: string | null;
  marcaId?: string | null;
  descripcion?: string | null;
  codigoBarras?: string | null;
  sku?: string | null;
  usaVariantes?: boolean;
  imagenUrl?: string | null;
  /**
   * URL de una imagen que ya vive en nuestro propio R2 (típicamente proviene
   * del catálogo maestro). Se referencia tal cual, sin duplicar el binario.
   */
  imagenUrlExterna?: string | null;
  /** Stock inicial a registrar al crear el producto. Requiere ubicacionId. */
  stockInicial?: number | null;
  /** Ubicación donde registrar el stock inicial. */
  ubicacionId?: string | null;
}

export interface ActualizarProductoInput {
  negocioId: string;
  productoId: string;
  token: string;
  nombre?: string;
  descripcion?: string | null;
  categoriaId?: string | null;
  marcaId?: string | null;
  codigoBarras?: string | null;
  sku?: string | null;
  precioVentaFinalUnitario?: number;
  costoNetoUnitario?: number;
  precioOferta?: number | null;
}

export interface SignedUrlInput {
  negocioId: string;
  productoId: string;
  token: string;
  contentType: string;
}
export interface SignedUrlResult {
  /** URL firmada para hacer PUT del binario. */
  signedUrl: string;
  /** Path interno en el bucket; es lo que se manda luego a confirmar. */
  path: string;
}

export interface ConfirmarImagenInput {
  negocioId: string;
  productoId: string;
  token: string;
  path: string;
}

export interface DesactivarProductoParams {
  negocioId: string;
  productoId: string;
  token: string;
}

export interface BuscarPorCodigoBarrasParams {
  negocioId: string;
  codigoBarras: string;
  token: string;
  incluirInactivos?: boolean;
}

export interface ProductoRepository {
  buscar(params: BuscarProductoParams): Promise<Producto[]>;
  obtener(params: ObtenerProductoParams): Promise<Producto>;
  crear(params: CrearProductoInput): Promise<Producto>;
  actualizar(params: ActualizarProductoInput): Promise<Producto>;
  generarSignedUrl(params: SignedUrlInput): Promise<SignedUrlResult>;
  confirmarImagen(params: ConfirmarImagenInput): Promise<Producto>;
  desactivar(params: DesactivarProductoParams): Promise<void>;
  activar(params: DesactivarProductoParams): Promise<void>;
  /** Retorna null si no existe producto con ese código de barras. */
  buscarPorCodigoBarras(params: BuscarPorCodigoBarrasParams): Promise<Producto | null>;
}
