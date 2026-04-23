import NetInfo, { NetInfoSubscription } from '@react-native-community/netinfo';
import { SqliteCatalogoLocalRepository } from '../../contexts/catalogo-local/infrastructure/SqliteCatalogoLocalRepository';
import { SyncCatalogoUseCase } from '../../contexts/catalogo-local/application/SyncCatalogoUseCase';
import { useCatalogoSyncStore } from '../stores/CatalogoSyncStore';

const repo = new SqliteCatalogoLocalRepository();
const syncUseCase = new SyncCatalogoUseCase(repo);

let netInfoUnsubscribe: NetInfoSubscription | null = null;
let inited = false;
let syncing = false;

async function getActiveSesion(): Promise<{ token: string; negocioId: string; ubicacionId: string } | null> {
  const { useSesionStore } = await import('../stores/SesionStore');
  const { sesion, negocio } = useSesionStore.getState();
  if (!sesion || !negocio) return null;
  const ubicacionId = negocio.ubicacionId;
  if (!ubicacionId) return null;
  return { token: sesion.token, negocioId: negocio.id, ubicacionId };
}

async function refreshStore(): Promise<void> {
  const lastSyncAt = await repo.lastSyncAt();
  const empty = await repo.isEmpty();
  useCatalogoSyncStore.setState({ lastSyncAt, empty });
}

/** Inicializa el catálogo local. Llamar una vez al bootstrap de la app. */
export async function initCatalogoSync(): Promise<void> {
  if (inited) return;
  inited = true;
  await repo.init();
  await refreshStore();

  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);
    if (online) {
      // Re-sync al volver la conexión.
      void trySyncCatalogo();
    }
  });

  // Dispara una sync inicial si hay sesión y red.
  void trySyncCatalogo();
}

export function disposeCatalogoSync(): void {
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
  inited = false;
}

/** Dispara una sync si hay sesión + red. Seguro llamar múltiples veces. */
export async function trySyncCatalogo(options?: { forceFull?: boolean }): Promise<void> {
  if (syncing) return;
  const sesion = await getActiveSesion();
  if (!sesion) return;

  syncing = true;
  useCatalogoSyncStore.getState().setSyncing(true);
  useCatalogoSyncStore.getState().setError(null);
  try {
    const res = await syncUseCase.execute({
      negocioId: sesion.negocioId,
      ubicacionId: sesion.ubicacionId,
      token: sesion.token,
      forceFull: options?.forceFull,
    });
    useCatalogoSyncStore.getState().setLastSyncAt(res.serverTime);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    useCatalogoSyncStore.getState().setError(msg);
  } finally {
    syncing = false;
    useCatalogoSyncStore.getState().setSyncing(false);
    await refreshStore();
  }
}

/** Expone el repo para que el POS / DI consuman el catálogo local. */
export const catalogoLocal = {
  repo,
  syncUseCase,
  async sincronizarManual(): Promise<void> {
    await trySyncCatalogo({ forceFull: false });
  },
};
