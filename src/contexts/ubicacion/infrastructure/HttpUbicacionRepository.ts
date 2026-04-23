import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import type { UbicacionRepository } from '../domain/UbicacionRepository';
import { Ubicacion, type TipoUbicacion } from '../domain/Ubicacion';

interface UbicacionResponse {
  id: string;
  nombre: string;
  tipo: TipoUbicacion;
  esPrincipal: boolean;
}

export class HttpUbicacionRepository implements UbicacionRepository {
  async listar({ negocioId, token }: { negocioId: string; token: string }): Promise<Ubicacion[]> {
    const raw = await httpClient.get<UbicacionResponse[]>(
      `/tiendas/${negocioId}/ubicaciones`,
      { token },
    );
    return raw.map((r) =>
      Ubicacion.create({
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        esPrincipal: r.esPrincipal,
      }),
    );
  }
}
