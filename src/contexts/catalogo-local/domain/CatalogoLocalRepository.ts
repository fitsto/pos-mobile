import type {
  CatalogoProducto,
  CatalogoSnapshot,
  CatalogoVariante,
  CatalogoModelo,
  CatalogoConfig,
} from './CatalogoSnapshot';

/**
 * Resultado de búsqueda local: el producto "frío" + el stock agregado
 * en la ubicación activa (para mostrar en la lista del POS).
 */
export interface ProductoLocalConStock {
  producto: CatalogoProducto;
  stockAgregado: number;
  tieneVariantes: boolean;
}

export interface BuscarProductosLocalParams {
  q: string;
  ubicacionId: string;
  limit?: number;
  /** Filtra a productos cuya `categoriaId` esté en el array. Vacío/undefined = sin filtro. */
  categoriaIds?: string[];
  /** Filtra a productos cuya `marcaId` esté en el array. Vacío/undefined = sin filtro. */
  marcaIds?: string[];
  /** Si true, solo devuelve productos con stockAgregado > 0 en la ubicación. */
  soloConStock?: boolean;
}

export interface CatalogoLocalRepository {
  /** Crea tablas e índices si no existen. */
  init(): Promise<void>;

  /** Busca productos por nombre/codigoInterno/codigoBarra y devuelve stock de ubicación. */
  buscarProductos(params: BuscarProductosLocalParams): Promise<ProductoLocalConStock[]>;

  /** Categorías que efectivamente tienen al menos un producto activo asignado. */
  listarCategoriasUsadas(): Promise<{ id: string; nombre: string }[]>;

  /** Marcas que efectivamente tienen al menos un producto activo asignado. */
  listarMarcasUsadas(): Promise<{ id: string; nombre: string }[]>;

  findProductoById(id: string): Promise<CatalogoProducto | null>;

  findVariantesByProducto(productoId: string): Promise<CatalogoVariante[]>;

  findModelosByProducto(productoId: string): Promise<CatalogoModelo[]>;

  /** Stock local para (producto, variante?, ubicacion). Devuelve 0 si no hay fila. */
  findStockLocal(productoId: string, varianteId: string | null, ubicacionId: string): Promise<number>;

  /** Descuenta cantidad del stock local. Si no hay fila, crea con cantidad negativa (permitirVentaSinStock). */
  decrementStockLocal(
    productoId: string,
    varianteId: string | null,
    ubicacionId: string,
    cantidad: number,
  ): Promise<void>;

  /** Timestamp (ISO) de la última sync ejecutada con éxito. null si no hubo ninguna. */
  lastSyncAt(): Promise<string | null>;

  /** Config de negocio almacenada en la última sync (impuesto, permitirVentaSinStock, etc). */
  getConfig(): Promise<CatalogoConfig | null>;

  /** Reemplaza todo el catálogo local (snapshot inicial). */
  aplicarSnapshot(snapshot: CatalogoSnapshot): Promise<void>;

  /** Merge incremental por id. Borra filas desactivadas. */
  aplicarDiff(snapshot: CatalogoSnapshot): Promise<void>;

  /** true si no hay productos cargados (primera sync nunca hecha). */
  isEmpty(): Promise<boolean>;

  /** Guarda el ubicacionId que se usó en la última sync (para warning de cambio de ubicación). */
  setUbicacionId(ubicacionId: string): Promise<void>;
  getUbicacionId(): Promise<string | null>;
}
