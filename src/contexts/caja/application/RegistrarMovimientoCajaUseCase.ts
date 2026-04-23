import { DomainError } from '../../shared/domain/DomainError';
import type { CajaRepository, MovimientoParams } from '../domain/CajaRepository';
import type { MovimientoCajaData } from '../domain/MovimientoCaja';

export class RegistrarMovimientoCajaUseCase {
  constructor(private readonly repo: CajaRepository) {}

  execute(p: MovimientoParams): Promise<MovimientoCajaData> {
    if (p.monto <= 0) throw new DomainError('El monto debe ser positivo');
    return this.repo.registrarMovimiento(p);
  }
}
