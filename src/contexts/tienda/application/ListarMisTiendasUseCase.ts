import type { Tienda } from '../domain/Tienda';
import type { TiendaRepository } from '../domain/TiendaRepository';

export class ListarMisTiendasUseCase {
  constructor(private readonly repo: TiendaRepository) {}

  execute(token: string): Promise<Tienda[]> {
    return this.repo.listarMisNegocios(token);
  }
}
