import type { ProductoRepository } from '../domain/ProductoRepository';

export interface ActivarProductoInput {
  negocioId: string;
  productoId: string;
  token: string;
}

/**
 * Reactiva un producto previamente desactivado (soft-deleted).
 * Idempotente: si ya está activo, el backend responde ok igualmente.
 */
export class ActivarProductoUseCase {
  constructor(private readonly repo: ProductoRepository) {}

  execute(input: ActivarProductoInput): Promise<void> {
    return this.repo.activar(input);
  }
}
