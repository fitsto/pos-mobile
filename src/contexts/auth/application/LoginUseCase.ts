import { DomainError } from '../../shared/domain/DomainError';
import type { AuthRepository, LoginCredenciales, SesionStorage } from '../domain/AuthRepository';
import type { Sesion } from '../domain/Sesion';

export class LoginUseCase {
  constructor(
    private readonly auth: AuthRepository,
    private readonly storage: SesionStorage,
  ) {}

  async execute(creds: LoginCredenciales): Promise<Sesion> {
    if (!creds.email?.trim()) throw new DomainError('El email es requerido');
    if (!creds.password) throw new DomainError('La contraseña es requerida');
    const sesion = await this.auth.login({ email: creds.email.trim().toLowerCase(), password: creds.password });
    await this.storage.guardar(sesion);
    return sesion;
  }
}
