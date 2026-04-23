import type { Producto } from '../domain/Producto';
import type { BuscarProductoParams, ProductoRepository } from '../domain/ProductoRepository';

export class BuscarProductoUseCase {
  constructor(private readonly repo: ProductoRepository) {}

  execute(params: BuscarProductoParams): Promise<Producto[]> {
    // Sin query: devolvemos el catálogo completo (paginado por el backend)
    // para que el POS pueda mostrarlo al entrar sin buscar nada.
    const query = params.query?.trim() ?? '';
    return this.repo.buscar({ ...params, query });
  }
}
