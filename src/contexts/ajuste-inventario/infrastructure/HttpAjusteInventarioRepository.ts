import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import type {
  AjusteInventarioRepository,
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
}
