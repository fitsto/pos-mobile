import type { VentaDetalle } from '../domain/Venta';
import type { VentaRepository } from '../domain/VentaRepository';

export class ObtenerVentaUseCase {
  constructor(private readonly repo: VentaRepository) {}
  execute(params: { negocioId: string; ventaId: string; token: string }): Promise<VentaDetalle> {
    return this.repo.obtenerPorId(params);
  }
}
