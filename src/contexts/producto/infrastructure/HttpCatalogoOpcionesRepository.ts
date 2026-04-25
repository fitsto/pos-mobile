import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import type { Categoria, Marca } from '../domain/Categoria';
import type {
  CatalogoOpcionesRepository,
  ListarParams,
} from '../domain/CatalogoOpcionesRepository';

interface ApiCategoria {
  id: string;
  nombre: string;
}

interface ApiMarca {
  id: string;
  nombre: string;
}

export class HttpCatalogoOpcionesRepository implements CatalogoOpcionesRepository {
  async listarCategorias({ negocioId, token }: ListarParams): Promise<Categoria[]> {
    const raw = await httpClient.get<ApiCategoria[]>(
      `/tiendas/${negocioId}/categorias`,
      { token },
    );
    return raw.map((c) => ({ id: c.id, nombre: c.nombre }));
  }

  async listarMarcas({ negocioId, token }: ListarParams): Promise<Marca[]> {
    const raw = await httpClient.get<ApiMarca[]>(
      `/tiendas/${negocioId}/marcas`,
      { token },
    );
    return raw.map((m) => ({ id: m.id, nombre: m.nombre }));
  }
}
