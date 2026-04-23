import type { PendingOperation, PendingOperationStatus } from './PendingOperation';

export interface OfflineQueueRepository {
  init(): Promise<void>;
  enqueue(op: PendingOperation): Promise<void>;
  list(): Promise<PendingOperation[]>;
  listByStatus(status: PendingOperationStatus): Promise<PendingOperation[]>;
  get(id: string): Promise<PendingOperation | null>;
  markSyncing(id: string): Promise<void>;
  markPending(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  remove(id: string): Promise<void>;
  incrementAttempts(id: string): Promise<void>;
  count(): Promise<number>;
  countPending(): Promise<number>;
}
