import type { SesionStorage } from '../domain/AuthRepository';
import type { Sesion } from '../domain/Sesion';

export class RestaurarSesionUseCase {
  constructor(private readonly storage: SesionStorage) {}

  execute(): Promise<Sesion | null> {
    return this.storage.cargar();
  }
}
