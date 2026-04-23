import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import type { CatalogoLocalRepository } from '../domain/CatalogoLocalRepository';
import type { CatalogoSnapshot } from '../domain/CatalogoSnapshot';

export interface SyncCatalogoParams {
  negocioId: string;
  ubicacionId: string;
  token: string;
  /** Fuerza un snapshot inicial (ignora `lastSyncAt`). */
  forceFull?: boolean;
}

/**
 * Trae el catálogo remoto y lo aplica al SQLite local.
 * Idempotente: reintentable sin efectos secundarios (el servidor devuelve un snapshot
 * determinístico para un `since` dado). Si la ubicación cambió respecto a la última
 * sync, fuerza full.
 */
export class SyncCatalogoUseCase {
  constructor(private readonly repo: CatalogoLocalRepository) {}

  async execute(params: SyncCatalogoParams): Promise<{ aplicado: 'inicial' | 'diff'; serverTime: string }> {
    await this.repo.init();
    const ubicacionGuardada = await this.repo.getUbicacionId();
    const cambioUbicacion = ubicacionGuardada !== null && ubicacionGuardada !== params.ubicacionId;

    const lastSyncAt = cambioUbicacion || params.forceFull ? null : await this.repo.lastSyncAt();

    const qs = new URLSearchParams();
    qs.set('ubicacionId', params.ubicacionId);
    if (lastSyncAt) qs.set('since', lastSyncAt);

    const snapshot = await httpClient.get<CatalogoSnapshot>(
      `/tiendas/${params.negocioId}/catalogo?${qs.toString()}`,
      { token: params.token },
    );

    if (snapshot.esSnapshotInicial) {
      await this.repo.aplicarSnapshot(snapshot);
    } else {
      await this.repo.aplicarDiff(snapshot);
    }
    await this.repo.setUbicacionId(params.ubicacionId);

    return {
      aplicado: snapshot.esSnapshotInicial ? 'inicial' : 'diff',
      serverTime: snapshot.serverTime,
    };
  }
}
