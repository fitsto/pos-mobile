import type { Stock } from './Stock';

export interface ListarStockParams {
  negocioId: string;
  ubicacionId: string;
  token: string;
  varianteId?: string;
}

export interface ListarStockPorProductoParams {
  negocioId: string;
  productoId: string;
  token: string;
}

export interface StockRepository {
  listarPorUbicacion(params: ListarStockParams): Promise<Stock[]>;
  /** Devuelve el stock del producto en todas las ubicaciones donde tenga registro. */
  listarPorProducto(params: ListarStockPorProductoParams): Promise<Stock[]>;
}
