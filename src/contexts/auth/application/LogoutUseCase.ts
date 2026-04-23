import type { SesionStorage } from '../domain/AuthRepository';

export class LogoutUseCase {
  constructor(private readonly storage: SesionStorage) {}

  async execute(): Promise<void> {
    await this.storage.limpiar();
  }
}
