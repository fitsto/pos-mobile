import type { Stock } from '../domain/Stock';
import type { ListarStockParams, StockRepository } from '../domain/StockRepository';

export class ListarStockPorUbicacionUseCase {
  constructor(private readonly repo: StockRepository) {}

  execute(params: ListarStockParams): Promise<Stock[]> {
    return this.repo.listarPorUbicacion(params);
  }
}
