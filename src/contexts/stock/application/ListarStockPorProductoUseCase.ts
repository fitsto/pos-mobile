import type { Stock } from '../domain/Stock';
import type {
  ListarStockPorProductoParams,
  StockRepository,
} from '../domain/StockRepository';

/**
 * Devuelve el stock de un producto en todas las ubicaciones donde tenga
 * registro. Útil para la pestaña Stock del detalle del producto: el operario
 * ve "Principal: 10, Bodega: 5" sin tener que cambiar de ubicación.
 */
export class ListarStockPorProductoUseCase {
  constructor(private readonly repo: StockRepository) {}

  execute(params: ListarStockPorProductoParams): Promise<Stock[]> {
    return this.repo.listarPorProducto(params);
  }
}
