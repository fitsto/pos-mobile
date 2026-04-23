import { create } from 'zustand';
import type { PendingOperation } from '../../contexts/offline-queue/domain/PendingOperation';

interface OfflineQueueState {
  /** true = hay red, false = sin red. null = desconocido (aún no se inicializó). */
  online: boolean | null;
  /** Snapshot de operaciones pendientes en SQLite. Se refresca tras cada cambio. */
  operaciones: PendingOperation[];
  /** true mientras el worker está drenando la cola. */
  sincronizando: boolean;

  setOnline: (v: boolean) => void;
  setOperaciones: (ops: PendingOperation[]) => void;
  setSincronizando: (v: boolean) => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set) => ({
  online: null,
  operaciones: [],
  sincronizando: false,
  setOnline: (online) => set({ online }),
  setOperaciones: (operaciones) => set({ operaciones }),
  setSincronizando: (sincronizando) => set({ sincronizando }),
}));

/** Selectores de conveniencia. */
export const selectPendingCount = (s: OfflineQueueState) =>
  s.operaciones.filter((o) => o.status !== 'syncing').length;

export const selectFailedCount = (s: OfflineQueueState) =>
  s.operaciones.filter((o) => o.status === 'failed').length;
