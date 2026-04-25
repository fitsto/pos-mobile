import type { Marca } from '../domain/Categoria';
import type {
  CatalogoOpcionesRepository,
  CrearOpcionParams,
} from '../domain/CatalogoOpcionesRepository';

export class CrearMarcaUseCase {
  constructor(private readonly repo: CatalogoOpcionesRepository) {}

  async execute(params: CrearOpcionParams): Promise<Marca> {
    const nombre = params.nombre.trim();
    if (!nombre) throw new Error('El nombre de la marca no puede estar vacío.');
    return this.repo.crearMarca({ ...params, nombre });
  }
}
