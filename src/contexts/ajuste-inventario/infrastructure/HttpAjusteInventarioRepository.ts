import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import type {
  AjusteInventarioRepository,
  ListarMovimientosParams,
  MovimientoInventarioData,
  RegistrarAjusteParams,
} from '../domain/AjusteInventarioRepository';

export class HttpAjusteInventarioRepository implements AjusteInventarioRepository {
  async registrar(p: RegistrarAjusteParams): Promise<MovimientoInventarioData> {
    return httpClient.post<MovimientoInventarioData>(
      `/tiendas/${p.negocioId}/ajustes-inventario`,
      {
        productoId: p.productoId,
        ...(p.varianteId ? { varianteId: p.varianteId } : {}),
        ubicacionId: p.ubicacionId,
        cantidad: p.cantidad,
        motivo: p.motivo,
        ...(p.comentario ? { comentario: p.comentario } : {}),
      },
      { token: p.token },
    );
  }

  async listar(p: ListarMovimientosParams): Promise<MovimientoInventarioData[]> {
    const qs: string[] = [];
    if (p.productoId) qs.push(`productoId=${encodeURIComponent(p.productoId)}`);
    if (p.ubicacionId) qs.push(`ubicacionId=${encodeURIComponent(p.ubicacionId)}`);
    if (p.varianteId) qs.push(`varianteId=${encodeURIComponent(p.varianteId)}`);
    if (p.tipo) qs.push(`tipo=${p.tipo}`);
    if (p.motivo) qs.push(`motivo=${encodeURIComponent(p.motivo)}`);
    if (p.desde) qs.push(`desde=${encodeURIComponent(p.desde)}`);
    if (p.hasta) qs.push(`hasta=${encodeURIComponent(p.hasta)}`);
    if (p.limit != null) qs.push(`limit=${p.limit}`);
    if (p.offset != null) qs.push(`offset=${p.offset}`);
    const query = qs.length ? `?${qs.join('&')}` : '';
    return httpClient.get<MovimientoInventarioData[]>(
      `/tiendas/${p.negocioId}/ajustes-inventario${query}`,
      { token: p.token },
    );
  }
}
