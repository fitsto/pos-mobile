import type { AuthRepository, RefreshSessionResult } from '../domain/AuthRepository';

export class RefreshSessionUseCase {
  constructor(private readonly repo: AuthRepository) {}

  async execute(refreshToken: string): Promise<RefreshSessionResult> {
    return this.repo.refresh(refreshToken);
  }
}
