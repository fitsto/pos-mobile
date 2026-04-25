import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import type { Stock } from '../domain/Stock';
import type {
  ListarStockParams,
  ListarStockPorProductoParams,
  StockRepository,
} from '../domain/StockRepository';

interface ApiStock {
  productoId: string;
  ubicacionId: string;
  cantidad: number;
  varianteId?: string | null;
  varianteTalla?: string | null;
  modeloNombre?: string | null;
}

export class HttpStockRepository implements StockRepository {
  async listarPorUbicacion({ negocioId, ubicacionId, token, varianteId }: ListarStockParams): Promise<Stock[]> {
    const params = new URLSearchParams({ ubicacionId });
    if (varianteId) params.set('varianteId', varianteId);
    const raw = await httpClient.get<ApiStock[]>(
      `/tiendas/${negocioId}/stock?${params}`,
      { token },
    );
    return raw.map(toStock);
  }

  async listarPorProducto({
    negocioId,
    productoId,
    token,
  }: ListarStockPorProductoParams): Promise<Stock[]> {
    const params = new URLSearchParams({ productoId });
    const raw = await httpClient.get<ApiStock[]>(
      `/tiendas/${negocioId}/stock?${params}`,
      { token },
    );
    return raw.map(toStock);
  }
}

function toStock(s: ApiStock): Stock {
  return {
    productoId: s.productoId,
    ubicacionId: s.ubicacionId,
    cantidad: Number(s.cantidad),
    varianteId: s.varianteId ?? null,
    varianteTalla: s.varianteTalla ?? null,
    modeloNombre: s.modeloNombre ?? null,
  };
}
