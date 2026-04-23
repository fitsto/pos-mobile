import type { UbicacionRepository } from '../domain/UbicacionRepository';
import type { Ubicacion } from '../domain/Ubicacion';

export class ListarUbicacionesUseCase {
  constructor(private readonly repo: UbicacionRepository) {}

  execute(input: { negocioId: string; token: string }): Promise<Ubicacion[]> {
    return this.repo.listar(input);
  }
}
