import type { ProductoRepository } from '../domain/ProductoRepository';

export interface DesactivarProductoInput {
  negocioId: string;
  productoId: string;
  token: string;
}

/**
 * Desactiva (soft delete) un producto. El backend lo marca como inactivo
 * para que no aparezca en búsqueda ni catálogo, pero mantiene el histórico
 * intacto (ventas pasadas, ajustes, etc.).
 */
export class DesactivarProductoUseCase {
  constructor(private readonly repo: ProductoRepository) {}

  execute(input: DesactivarProductoInput): Promise<void> {
    return this.repo.desactivar(input);
  }
}
