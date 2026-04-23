import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import { Producto } from '../domain/Producto';
import type { BuscarProductoParams, ProductoRepository } from '../domain/ProductoRepository';

interface ApiProducto {
  id: string;
  nombre: string;
  codigoBarras: string | null;
  sku: string | null;
  precioVentaFinalUnitario: number;
  precioOferta: number | null;
  imagenUrl: string | null;
  activo: boolean;
}

interface ApiPaginado {
  items: ApiProducto[];
  total: number;
  page: number;
  pageSize: number;
}

export class HttpProductoRepository implements ProductoRepository {
  async buscar({ negocioId, query, token, ubicacionId }: BuscarProductoParams): Promise<Producto[]> {
    const params = new URLSearchParams({ pageSize: '50' });
    if (query && query.trim()) params.set('query', query.trim());
    if (ubicacionId) params.set('ubicacionId', ubicacionId);
    const raw = await httpClient.get<ApiPaginado>(
      `/tiendas/${negocioId}/productos?${params}`,
      { token },
    );
    return raw.items
      .filter((p) => p.activo)
      .map((p) => Producto.create(p));
  }
}
