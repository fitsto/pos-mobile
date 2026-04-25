import NetInfo, { NetInfoSubscription } from '@react-native-community/netinfo';
import { SqliteCatalogoLocalRepository } from '../../contexts/catalogo-local/infrastructure/SqliteCatalogoLocalRepository';
import { SyncCatalogoUseCase } from '../../contexts/catalogo-local/application/SyncCatalogoUseCase';
import { httpClient } from '../../contexts/shared/infrastructure/http/HttpClient';
import { useCatalogoSyncStore } from '../stores/CatalogoSyncStore';

interface ApiUbicacionLista {
  id: string;
  nombre: string;
  esPrincipal: boolean;
  tipo: 'SUCURSAL' | 'BODEGA';
}

/**
 * Resuelve la ubicación efectiva para el rol actual.
 * - Si el miembro tiene ubicacionId asignada, esa manda.
 * - Si no (típico ADMIN/CAJERO multi-sucursal), pide la lista al backend
 *   y elige la principal; si no hay principal, la primera SUCURSAL;
 *   si sólo hay BODEGAS, la primera disponible.
 */
async function resolverUbicacion(params: {
  organizationId: string;
  token: string;
  ubicacionAsignada: string | null;
}): Promise<{ id: string; nombre: string } | null> {
  if (params.ubicacionAsignada) {
    return { id: params.ubicacionAsignada, nombre: '' };
  }
  try {
    const ubicaciones = await httpClient.get<ApiUbicacionLista[]>(
      `/tiendas/${params.organizationId}/ubicaciones`,
      { token: params.token },
    );
    if (!ubicaciones.length) return null;
    const principal = ubicaciones.find((u) => u.esPrincipal);
    if (principal) return { id: principal.id, nombre: principal.nombre };
    const sucursal = ubicaciones.find((u) => u.tipo === 'SUCURSAL');
    if (sucursal) return { id: sucursal.id, nombre: sucursal.nombre };
    return { id: ubicaciones[0].id, nombre: ubicaciones[0].nombre };
  } catch (e) {
    console.warn('[Catalogo] error listando ubicaciones', e);
    return null;
  }
}

const repo = new SqliteCatalogoLocalRepository();
const syncUseCase = new SyncCatalogoUseCase(repo);

let netInfoUnsubscribe: NetInfoSubscription | null = null;
let inited = false;
let syncing = false;

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
  if (syncing) {
    console.log('[Catalogo] sync ya en curso, skip');
    return;
  }
  const { useSesionStore } = await import('../stores/SesionStore');
  const { sesion, negocio } = useSesionStore.getState();
  if (!sesion || !negocio) {
    useCatalogoSyncStore.getState().setError('No hay una sesión activa.');
    return;
  }

  const ubicacionEfectiva = await resolverUbicacion({
    organizationId: negocio.id,
    token: sesion.token,
    ubicacionAsignada: negocio.ubicacionId,
  });

  if (!ubicacionEfectiva) {
    useCatalogoSyncStore
      .getState()
      .setError(
        'Esta tienda todavía no tiene ubicaciones creadas. Entra al panel web y crea una sucursal para empezar.',
      );
    return;
  }

  syncing = true;
  useCatalogoSyncStore.getState().setSyncing(true);
  useCatalogoSyncStore.getState().setError(null);
  try {
    console.log('[Catalogo] sync inicio', {
      organizationId: negocio.id,
      ubicacionId: ubicacionEfectiva.id,
      forceFull: options?.forceFull,
    });
    const res = await syncUseCase.execute({
      negocioId: negocio.id,
      ubicacionId: ubicacionEfectiva.id,
      token: sesion.token,
      forceFull: options?.forceFull,
    });
    useCatalogoSyncStore.getState().setLastSyncAt(res.serverTime);
    console.log('[Catalogo] sync ok', res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[Catalogo] sync error', msg);
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
