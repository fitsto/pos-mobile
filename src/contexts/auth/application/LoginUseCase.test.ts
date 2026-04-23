import { describe, it, expect, vi } from 'vitest';
import { LoginUseCase } from './LoginUseCase';
import { Sesion } from '../domain/Sesion';
import type { AuthRepository, SesionStorage } from '../domain/AuthRepository';
import { DomainError } from '../../shared/domain/DomainError';

function makeUseCase() {
  const repo: AuthRepository = {
    login: vi.fn(async ({ email }) =>
      Sesion.create({
        token: 'tok',
        refreshToken: 'rt',
        expiresAt: 0,
        usuario: { id: 'u', email, nombre: null },
      }),
    ),
    refresh: vi.fn(async () => ({ token: 'tok2', refreshToken: 'rt2', expiresAt: 0 })),
  };
  const storage: SesionStorage = {
    guardar: vi.fn(async () => {}),
    cargar: vi.fn(async () => null),
    limpiar: vi.fn(async () => {}),
  };
  return { repo, storage, useCase: new LoginUseCase(repo, storage) };
}

describe('LoginUseCase', () => {
  it('valida email requerido', async () => {
    const { useCase } = makeUseCase();
    await expect(useCase.execute({ email: ' ', password: 'p' })).rejects.toBeInstanceOf(DomainError);
  });

  it('valida password requerida', async () => {
    const { useCase } = makeUseCase();
    await expect(useCase.execute({ email: 'a@b.com', password: '' })).rejects.toBeInstanceOf(DomainError);
  });

  it('normaliza email (trim + lowercase) y persiste sesion', async () => {
    const { useCase, repo, storage } = makeUseCase();
    const s = await useCase.execute({ email: '  A@B.COM ', password: 'p' });
    expect(repo.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'p' });
    expect(storage.guardar).toHaveBeenCalledWith(s);
    expect(s.usuario.email).toBe('a@b.com');
  });
});
