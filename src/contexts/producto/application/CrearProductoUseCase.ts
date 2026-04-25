import type { Producto } from '../domain/Producto';
import type { CrearProductoInput, ProductoRepository } from '../domain/ProductoRepository';

export class CrearProductoUseCase {
  constructor(private readonly repo: ProductoRepository) {}

  execute(input: CrearProductoInput): Promise<Producto> {
    if (!input.nombre?.trim()) {
      throw new Error('El nombre es obligatorio');
    }
    if (input.precioVentaFinalUnitario < 0) {
      throw new Error('El precio no puede ser negativo');
    }
    return this.repo.crear({ ...input, nombre: input.nombre.trim() });
  }
}
