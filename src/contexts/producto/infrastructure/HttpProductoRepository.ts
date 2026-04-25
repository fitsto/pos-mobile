import { httpClient, HttpError } from '../../shared/infrastructure/http/HttpClient';
import { Producto } from '../domain/Producto';
import type {
  ActualizarProductoInput,
  BuscarPorCodigoBarrasParams,
  BuscarProductoParams,
  ConfirmarImagenInput,
  CrearProductoInput,
  DesactivarProductoParams,
  ObtenerProductoParams,
  ProductoRepository,
  SignedUrlInput,
  SignedUrlResult,
} from '../domain/ProductoRepository';

interface ApiProductoImagen {
  id: string;
  url: string;
}

interface ApiProducto {
  id: string;
  nombre: string;
  descripcion: string | null;
  codigoBarras: string | null;
  sku: string | null;
  costoNetoUnitario: number;
  precioVentaFinalUnitario: number;
  precioVentaNetoUnitario: number;
  precioOferta: number | null;
  imagenes?: ApiProductoImagen[];
  imagenUrl: string | null;
  activo: boolean;
  stockTotal?: number;
}

/**
 * Normaliza la respuesta del backend a ProductoData.
 * El listado paginado no siempre incluye `imagenes[]` completas ni descripción
 * ni costo; usamos defaults seguros.
 */
function toProductoData(p: ApiProducto) {
  return {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion ?? null,
    codigoBarras: p.codigoBarras,
    sku: p.sku,
    costoNetoUnitario: p.costoNetoUnitario ?? 0,
    precioVentaFinalUnitario: p.precioVentaFinalUnitario,
    precioVentaNetoUnitario: p.precioVentaNetoUnitario ?? p.precioVentaFinalUnitario,
    precioOferta: p.precioOferta,
    imagenes: p.imagenes ?? [],
    imagenUrl: p.imagenUrl,
    activo: p.activo,
    stockTotal: p.stockTotal ?? null,
  };
}

interface ApiPaginado {
  items: ApiProducto[];
  total: number;
  page: number;
  pageSize: number;
}

export class HttpProductoRepository implements ProductoRepository {
  async buscar({ negocioId, query, token, ubicacionId, incluirInactivos }: BuscarProductoParams): Promise<Producto[]> {
    const params = new URLSearchParams({ pageSize: '50' });
    if (query && query.trim()) params.set('query', query.trim());
    if (ubicacionId) params.set('ubicacionId', ubicacionId);
    if (incluirInactivos) params.set('incluirInactivos', 'true');
    const raw = await httpClient.get<ApiPaginado>(
      `/tiendas/${negocioId}/productos?${params}`,
      { token },
    );
    const items = incluirInactivos ? raw.items : raw.items.filter((p) => p.activo);
    return items.map((p) => Producto.create(toProductoData(p)));
  }

  async obtener({ negocioId, productoId, token }: ObtenerProductoParams): Promise<Producto> {
    const raw = await httpClient.get<ApiProducto>(
      `/tiendas/${negocioId}/productos/${productoId}`,
      { token },
    );
    return Producto.create(toProductoData(raw));
  }

  async crear({ negocioId, token, ...body }: CrearProductoInput): Promise<Producto> {
    const raw = await httpClient.post<ApiProducto>(
      `/tiendas/${negocioId}/productos`,
      body,
      { token },
    );
    return Producto.create(toProductoData(raw));
  }

  async actualizar({
    negocioId,
    productoId,
    token,
    ...body
  }: ActualizarProductoInput): Promise<Producto> {
    const raw = await httpClient.patch<ApiProducto>(
      `/tiendas/${negocioId}/productos/${productoId}`,
      body,
      { token },
    );
    return Producto.create(toProductoData(raw));
  }

  async generarSignedUrl({
    negocioId,
    productoId,
    token,
    contentType,
  }: SignedUrlInput): Promise<SignedUrlResult> {
    return httpClient.post<SignedUrlResult>(
      `/tiendas/${negocioId}/productos/${productoId}/imagen/signed-url`,
      { contentType },
      { token },
    );
  }

  async desactivar({ negocioId, productoId, token }: DesactivarProductoParams): Promise<void> {
    await httpClient.del<{ ok: boolean }>(
      `/tiendas/${negocioId}/productos/${productoId}`,
      { token },
    );
  }

  async buscarPorCodigoBarras({
    negocioId,
    codigoBarras,
    token,
    incluirInactivos,
  }: BuscarPorCodigoBarrasParams): Promise<Producto | null> {
    const qs = incluirInactivos ? '?incluirInactivos=true' : '';
    try {
      const raw = await httpClient.get<ApiProducto>(
        `/tiendas/${negocioId}/productos/por-codigo-barras/${encodeURIComponent(codigoBarras)}${qs}`,
        { token },
      );
      return Producto.create(toProductoData(raw));
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    }
  }

  async activar({ negocioId, productoId, token }: DesactivarProductoParams): Promise<void> {
    await httpClient.post<{ ok: boolean }>(
      `/tiendas/${negocioId}/productos/${productoId}/activar`,
      {},
      { token },
    );
  }

  async confirmarImagen({
    negocioId,
    productoId,
    token,
    path,
  }: ConfirmarImagenInput): Promise<Producto> {
    const raw = await httpClient.post<ApiProducto>(
      `/tiendas/${negocioId}/productos/${productoId}/imagen/confirmar`,
      { path },
      { token },
    );
    return Producto.create(toProductoData(raw));
  }
}
