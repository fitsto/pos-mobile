import type { Categoria } from '../domain/Categoria';
import type {
  CatalogoOpcionesRepository,
  CrearOpcionParams,
} from '../domain/CatalogoOpcionesRepository';

export class CrearCategoriaUseCase {
  constructor(private readonly repo: CatalogoOpcionesRepository) {}

  async execute(params: CrearOpcionParams): Promise<Categoria> {
    const nombre = params.nombre.trim();
    if (!nombre) throw new Error('El nombre de la categoría no puede estar vacío.');
    return this.repo.crearCategoria({ ...params, nombre });
  }
}
