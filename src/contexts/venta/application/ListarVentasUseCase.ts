import type {
  ListarVentasParams,
  ListarVentasResultado,
  VentaRepository,
} from '../domain/VentaRepository';

export class ListarVentasUseCase {
  constructor(private readonly repo: VentaRepository) {}
  execute(params: ListarVentasParams): Promise<ListarVentasResultado> {
    return this.repo.listar(params);
  }
}
