import type { Stock } from './Stock';

export interface ListarStockParams {
  negocioId: string;
  ubicacionId: string;
  token: string;
  varianteId?: string;
}

export interface StockRepository {
  listarPorUbicacion(params: ListarStockParams): Promise<Stock[]>;
}
