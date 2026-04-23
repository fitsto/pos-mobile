import type { CajaActualResult, CajaRepository } from '../domain/CajaRepository';

export class ObtenerCajaActualUseCase {
  constructor(private readonly repo: CajaRepository) {}

  execute(p: { negocioId: string; ubicacionId: string; token: string }): Promise<CajaActualResult> {
    return this.repo.obtenerActual(p);
  }
}
