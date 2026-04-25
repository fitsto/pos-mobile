import type {
  AjusteInventarioRepository,
  ListarMovimientosParams,
  MovimientoInventarioData,
} from '../domain/AjusteInventarioRepository';

export class ListarMovimientosUseCase {
  constructor(private readonly repo: AjusteInventarioRepository) {}

  execute(p: ListarMovimientosParams): Promise<MovimientoInventarioData[]> {
    return this.repo.listar(p);
  }
}
