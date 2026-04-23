import { create } from 'zustand';

interface CatalogoSyncState {
  /** ISO string del último `serverTime` aplicado. null si nunca sincronizó. */
  lastSyncAt: string | null;
  /** true mientras corre una sync. */
  syncing: boolean;
  /** Último error de sync (si no dejó limpio). */
  error: string | null;
  /** true si el SQLite local está vacío (primera sync pendiente). */
  empty: boolean;

  setLastSyncAt: (iso: string | null) => void;
  setSyncing: (v: boolean) => void;
  setError: (e: string | null) => void;
  setEmpty: (v: boolean) => void;
}

export const useCatalogoSyncStore = create<CatalogoSyncState>((set) => ({
  lastSyncAt: null,
  syncing: false,
  error: null,
  empty: true,
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setSyncing: (syncing) => set({ syncing }),
  setError: (error) => set({ error }),
  setEmpty: (empty) => set({ empty }),
}));

/** Días transcurridos desde la última sync. null si nunca sincronizó. */
export function diasDesdeUltimaSync(lastSyncAt: string | null): number | null {
  if (!lastSyncAt) return null;
  const d = new Date(lastSyncAt).getTime();
  if (Number.isNaN(d)) return null;
  const diff = Date.now() - d;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
