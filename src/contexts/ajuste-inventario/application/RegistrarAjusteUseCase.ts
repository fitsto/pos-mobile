import { DomainError } from '../../shared/domain/DomainError';
import type {
  AjusteInventarioRepository,
  MovimientoInventarioData,
  RegistrarAjusteParams,
} from '../domain/AjusteInventarioRepository';

export class RegistrarAjusteUseCase {
  constructor(private readonly repo: AjusteInventarioRepository) {}

  execute(p: RegistrarAjusteParams): Promise<MovimientoInventarioData> {
    if (!Number.isInteger(p.cantidad)) throw new DomainError('La cantidad debe ser entera');
    if (p.cantidad === 0) throw new DomainError('La cantidad no puede ser cero');
    return this.repo.registrar(p);
  }
}
