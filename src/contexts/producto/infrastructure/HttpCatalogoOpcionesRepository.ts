import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import type { Categoria, Marca } from '../domain/Categoria';
import type {
  CatalogoOpcionesRepository,
  CrearOpcionParams,
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

  async crearCategoria({ negocioId, token, nombre }: CrearOpcionParams): Promise<Categoria> {
    const raw = await httpClient.post<ApiCategoria>(
      `/tiendas/${negocioId}/categorias`,
      { nombre },
      { token },
    );
    return { id: raw.id, nombre: raw.nombre };
  }

  async crearMarca({ negocioId, token, nombre }: CrearOpcionParams): Promise<Marca> {
    const raw = await httpClient.post<ApiMarca>(
      `/tiendas/${negocioId}/marcas`,
      { nombre },
      { token },
    );
    return { id: raw.id, nombre: raw.nombre };
  }
}
