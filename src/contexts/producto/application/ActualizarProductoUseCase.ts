import type { Producto } from '../domain/Producto';
import type { ActualizarProductoInput, ProductoRepository } from '../domain/ProductoRepository';

export class ActualizarProductoUseCase {
  constructor(private readonly repo: ProductoRepository) {}

  execute(input: ActualizarProductoInput): Promise<Producto> {
    if (input.nombre !== undefined && !input.nombre.trim()) {
      throw new Error('El nombre no puede estar vacío');
    }
    if (
      input.precioVentaFinalUnitario !== undefined &&
      input.precioVentaFinalUnitario < 0
    ) {
      throw new Error('El precio no puede ser negativo');
    }
    return this.repo.actualizar(input);
  }
}
