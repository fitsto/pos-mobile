import NetInfo, { NetInfoSubscription } from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { SqliteOfflineQueueRepository } from '../../contexts/offline-queue/infrastructure/SqliteOfflineQueueRepository';
import { SyncOfflineQueueUseCase } from '../../contexts/offline-queue/application/SyncOfflineQueueUseCase';
import {
  ajusteStockExecutor,
  transferirStockExecutor,
  ventaPresencialExecutor,
} from '../../contexts/offline-queue/application/operationExecutors';
import type {
  PendingOperation,
  PendingOperationType,
} from '../../contexts/offline-queue/domain/PendingOperation';
import { useOfflineQueueStore } from '../stores/OfflineQueueStore';

const repo = new SqliteOfflineQueueRepository();
const syncUseCase = new SyncOfflineQueueUseCase(repo, {
  AJUSTE_STOCK: ajusteStockExecutor,
  TRANSFERIR_STOCK: transferirStockExecutor,
  VENTA_PRESENCIAL: ventaPresencialExecutor,
});

let netInfoUnsubscribe: NetInfoSubscription | null = null;
let inited = false;

/** Refresca el snapshot de la cola en el store (para UI reactiva). */
async function refreshStore(): Promise<void> {
  const ops = await repo.list();
  useOfflineQueueStore.getState().setOperaciones(ops);
}

/**
 * Inicializa la DB de la cola y empieza a escuchar cambios de red.
 * Llamar una sola vez al arrancar la app (desde `_layout.tsx` tras sesión).
 */
export async function initOfflineQueue(): Promise<void> {
  if (inited) return;
  inited = true;
  await repo.init();
  // Si la app murió mientras una op estaba 'syncing', queda atascada en ese
  // estado para siempre (no aparece en listByStatus('pending')). La rescatamos.
  await repo.resetStaleSyncing();
  await refreshStore();

  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);
    const prev = useOfflineQueueStore.getState().online;
    useOfflineQueueStore.getState().setOnline(online);

    // Al recuperar red, disparamos sync automáticamente.
    if (prev === false && online) {
      void tryDrainQueue();
    }
  });
}

export function disposeOfflineQueue(): void {
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
  inited = false;
}

/** Obtener el token activo desde la sesión. Se resuelve lazy para evitar import circular. */
async function getActiveToken(): Promise<string | null> {
  const { useSesionStore } = await import('../stores/SesionStore');
  return useSesionStore.getState().sesion?.token ?? null;
}

/** Drena la cola si hay red y token. No falla ruidosamente; todo queda persistido. */
export async function tryDrainQueue(): Promise<void> {
  const { online } = useOfflineQueueStore.getState();
  if (online === false) return;

  const token = await getActiveToken();
  if (!token) return;

  useOfflineQueueStore.getState().setSincronizando(true);
  try {
    // Recovery defensivo antes de drenar: si quedó alguna 'syncing' atascada
    // de una corrida anterior, la traemos de vuelta al pool de 'pending'.
    await repo.resetStaleSyncing();
    await syncUseCase.execute({
      token,
      onProgress: () => {
        void refreshStore();
      },
    });
  } finally {
    useOfflineQueueStore.getState().setSincronizando(false);
    await refreshStore();
  }
}

/**
 * Intenta ejecutar la operación directamente; si falla por red, la encola.
 * Si hay operaciones previas en cola, también encola (preserva el orden FIFO).
 *
 * Devuelve `{ executedOnline: true }` si el servidor procesó la operación,
 * o `{ executedOnline: false, id }` si quedó en cola para sync posterior.
 */
export async function executeOrEnqueue(params: {
  type: PendingOperationType;
  negocioId: string;
  payload: Record<string, unknown>;
  label: string;
}): Promise<{ executedOnline: boolean; id: string }> {
  const { type, negocioId, payload, label } = params;

  const id = Crypto.randomUUID();
  const op: PendingOperation = {
    id,
    type,
    negocioId,
    payload,
    label,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
    lastError: null,
    lastAttemptAt: null,
  };

  // Si ya hay cola activa o estamos offline: encolamos sin intentar online,
  // para no salir de orden (una op nueva podría depender del stock que dejaron
  // ops previas). Las ops 'failed' no cuentan: están atascadas hasta que el
  // usuario las descarte/reintente, no tiene sentido bloquear ventas nuevas
  // por algo que ya falló permanentemente.
  const existing = await repo.list();
  const activas = existing.filter((o) => o.status !== 'failed');
  const online = useOfflineQueueStore.getState().online !== false;

  if (!online || activas.length > 0) {
    await repo.enqueue(op);
    await refreshStore();
    // Si hay red, intentamos drenar ya mismo (incluyendo la nueva).
    if (online) void tryDrainQueue();
    return { executedOnline: false, id };
  }

  // Estamos online y cola vacía: intento directo con idempotencia.
  const token = await getActiveToken();
  if (!token) {
    await repo.enqueue(op);
    await refreshStore();
    return { executedOnline: false, id };
  }

  try {
    const executor =
      type === 'AJUSTE_STOCK'
        ? ajusteStockExecutor
        : type === 'TRANSFERIR_STOCK'
          ? transferirStockExecutor
          : ventaPresencialExecutor;
    await executor(op, token);
    return { executedOnline: true, id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Error de red o 5xx → encolar. Errores 4xx bubbleamos para que el formulario
    // muestre el problema (no tiene sentido reintentar validación).
    if (/HTTP 4\d\d/.test(msg)) {
      throw error;
    }
    await repo.enqueue(op);
    await refreshStore();
    return { executedOnline: false, id };
  }
}

/** Expone el repo y el sync para la pantalla de Pendientes. */
export const offlineQueue = {
  repo,
  syncUseCase,
  refreshStore,
  async retryOperation(id: string): Promise<void> {
    const token = await getActiveToken();
    if (!token) return;
    await repo.markPending(id);
    await refreshStore();
    await tryDrainQueue();
  },
  async discardOperation(id: string): Promise<void> {
    await repo.remove(id);
    await refreshStore();
  },
};

/** Deriva 2 UUIDs desde uno raíz para idempotencia de transferencias. */
export function generarIdsTransferencia(): {
  idRaiz: string;
  clientMovimientoIdSalida: string;
  clientMovimientoIdEntrada: string;
} {
  const idRaiz = Crypto.randomUUID();
  return {
    idRaiz,
    clientMovimientoIdSalida: Crypto.randomUUID(),
    clientMovimientoIdEntrada: Crypto.randomUUID(),
  };
}
