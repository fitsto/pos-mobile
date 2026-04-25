import { httpClient, HttpError } from '../../shared/infrastructure/http/HttpClient';
import type { ProductoMaestro } from '../domain/ProductoMaestro';
import type {
  BuscarMaestroParams,
  ProductoMaestroRepository,
} from '../domain/ProductoMaestroRepository';

export class HttpProductoMaestroRepository implements ProductoMaestroRepository {
  async buscarPorCodigoBarras({
    negocioId,
    codigoBarras,
    token,
  }: BuscarMaestroParams): Promise<ProductoMaestro | null> {
    try {
      const raw = await httpClient.get<ProductoMaestro>(
        `/tiendas/${negocioId}/catalogo-maestro/por-codigo-barras/${encodeURIComponent(codigoBarras)}`,
        { token },
      );
      return raw;
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    }
  }
}
