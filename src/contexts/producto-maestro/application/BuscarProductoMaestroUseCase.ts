import type { ProductoMaestro } from '../domain/ProductoMaestro';
import type {
  BuscarMaestroParams,
  ProductoMaestroRepository,
} from '../domain/ProductoMaestroRepository';

export class BuscarProductoMaestroUseCase {
  constructor(private readonly repo: ProductoMaestroRepository) { }

  execute(params: BuscarMaestroParams): Promise<ProductoMaestro | null> {
    return this.repo.buscarPorCodigoBarras(params);
  }
}
