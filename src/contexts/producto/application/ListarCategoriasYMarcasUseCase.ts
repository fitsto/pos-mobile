import type { Categoria, Marca } from '../domain/Categoria';
import type {
  CatalogoOpcionesRepository,
  ListarParams,
} from '../domain/CatalogoOpcionesRepository';

/**
 * Devuelve categorías y marcas del negocio en paralelo. El wizard de creación
 * de producto las pide ambas a la vez para llenar dos pickers.
 */
export class ListarCategoriasYMarcasUseCase {
  constructor(private readonly repo: CatalogoOpcionesRepository) {}

  async execute(
    params: ListarParams,
  ): Promise<{ categorias: Categoria[]; marcas: Marca[] }> {
    const [categorias, marcas] = await Promise.all([
      this.repo.listarCategorias(params),
      this.repo.listarMarcas(params),
    ]);
    return { categorias, marcas };
  }
}
