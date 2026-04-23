import { DomainError } from '../../shared/domain/DomainError';
import type { Caja } from '../domain/Caja';
import type { CajaRepository, CerrarCajaParams } from '../domain/CajaRepository';

export class CerrarCajaUseCase {
  constructor(private readonly repo: CajaRepository) {}

  execute(p: CerrarCajaParams): Promise<Caja> {
    if (p.montoDeclarado < 0) throw new DomainError('El monto declarado no puede ser negativo');
    return this.repo.cerrar(p);
  }
}
