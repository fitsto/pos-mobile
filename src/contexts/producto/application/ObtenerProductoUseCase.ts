import type { Producto } from '../domain/Producto';
import type { ObtenerProductoParams, ProductoRepository } from '../domain/ProductoRepository';

export class ObtenerProductoUseCase {
  constructor(private readonly repo: ProductoRepository) {}

  execute(params: ObtenerProductoParams): Promise<Producto> {
    return this.repo.obtener(params);
  }
}
