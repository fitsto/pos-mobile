import type { Producto } from '../domain/Producto';
import type { ProductoRepository } from '../domain/ProductoRepository';

export interface BuscarProductoPorCodigoInput {
  negocioId: string;
  codigoBarras: string;
  token: string;
  /** Incluye también productos desactivados. */
  incluirInactivos?: boolean;
}

/**
 * Busca en el catálogo del negocio un producto con ese código de barras.
 * Retorna `null` si no existe (el endpoint devuelve 404 en ese caso y el
 * repositorio HTTP lo traduce a null para simplificar el consumo).
 *
 * Se usa en el flujo "nuevo producto" para:
 *   1. Evitar duplicados (si ya existe → abrir detalle en lugar de crear).
 *   2. Ofrecer reactivación si el match es un producto inactivo.
 *   3. Precargar `codigoBarras` en el formulario manual cuando no hay match.
 */
export class BuscarProductoPorCodigoUseCase {
  constructor(private readonly repo: ProductoRepository) {}

  execute(input: BuscarProductoPorCodigoInput): Promise<Producto | null> {
    return this.repo.buscarPorCodigoBarras(input);
  }
}
