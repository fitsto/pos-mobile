import type { OfflineQueueRepository } from '../domain/OfflineQueueRepository';
import type { PendingOperation } from '../domain/PendingOperation';

/**
 * Ejecutor específico por tipo de operación. Cada tipo conoce cómo llamar
 * al endpoint correspondiente incluyendo el `clientMovimientoId` para idempotencia.
 */
export type OperationExecutor = (op: PendingOperation, token: string) => Promise<void>;

export interface SyncOptions {
  token: string;
  /** Se llama tras cada cambio para refrescar UI (badge/contador). */
  onProgress?: () => void;
  /** Cantidad máxima de operaciones a procesar en esta corrida. */
  batchSize?: number;
}

const MAX_ATTEMPTS = 5;

/**
 * Errores que NO deben reintentarse automáticamente (errores de validación / 4xx permanentes).
 * Se detectan por status code en el mensaje (los HTTP errors del httpClient incluyen "HTTP 4xx").
 */
const NON_RETRYABLE_STATUS = [400, 401, 403, 404, 409, 422];

function esErrorNoReintentable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return NON_RETRYABLE_STATUS.some((s) => msg.includes(`HTTP ${s}`));
}

export class SyncOfflineQueueUseCase {
  constructor(
    private readonly repo: OfflineQueueRepository,
    private readonly executors: Record<PendingOperation['type'], OperationExecutor>,
  ) {}

  /**
   * Drena la cola en orden FIFO. Reintenta errores de red; marca como "failed"
   * los errores permanentes o los que superan MAX_ATTEMPTS. Siempre que se
   * dispara re-sincronización, se puede reintentar explícitamente las failed.
   */
  async execute(options: SyncOptions): Promise<{ ok: number; failed: number }> {
    const pending = await this.repo.listByStatus('pending');
    const limit = options.batchSize ?? pending.length;
    const batch = pending.slice(0, limit);

    let ok = 0;
    let failed = 0;

    for (const op of batch) {
      try {
        await this.repo.markSyncing(op.id);
        options.onProgress?.();

        const executor = this.executors[op.type];
        if (!executor) {
          await this.repo.markFailed(op.id, `Sin executor para tipo ${op.type}`);
          failed += 1;
          options.onProgress?.();
          continue;
        }

        await executor(op, options.token);
        // Éxito → borrar de la cola (el backend ya lo persistió).
        await this.repo.remove(op.id);
        ok += 1;
        options.onProgress?.();
      } catch (error) {
        await this.repo.incrementAttempts(op.id);
        const msg = error instanceof Error ? error.message : String(error);
        const attempts = op.attempts + 1;

        if (esErrorNoReintentable(error) || attempts >= MAX_ATTEMPTS) {
          await this.repo.markFailed(op.id, msg);
          failed += 1;
        } else {
          // Network error o 5xx → dejar pendiente para próximo intento.
          await this.repo.markPending(op.id);
        }
        options.onProgress?.();
      }
    }

    return { ok, failed };
  }

  /** Reintento manual de una operación que quedó marcada como failed. */
  async retryOne(id: string, token: string): Promise<void> {
    const op = await this.repo.get(id);
    if (!op) return;
    await this.repo.markPending(id);
    await this.execute({ token });
  }
}
