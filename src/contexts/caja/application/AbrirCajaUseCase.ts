import { DomainError } from '../../shared/domain/DomainError';
import type { Caja } from '../domain/Caja';
import type { AbrirCajaParams, CajaRepository } from '../domain/CajaRepository';

export class AbrirCajaUseCase {
  constructor(private readonly repo: CajaRepository) {}

  execute(p: AbrirCajaParams): Promise<Caja> {
    if (p.montoApertura < 0) throw new DomainError('El monto de apertura no puede ser negativo');
    return this.repo.abrir(p);
  }
}
