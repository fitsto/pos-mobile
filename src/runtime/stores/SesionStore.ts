import { create } from 'zustand';
import type { Sesion } from '../../contexts/auth/domain/Sesion';
import type { Tienda } from '../../contexts/tienda/domain/Tienda';

interface SesionState {
  sesion: Sesion | null;
  negocio: Tienda | null;
  cargando: boolean;
  setSesion: (sesion: Sesion | null) => void;
  setNegocio: (negocio: Tienda | null) => void;
  setCargando: (v: boolean) => void;
  reset: () => void;
}

export const useSesionStore = create<SesionState>((set) => ({
  sesion: null,
  negocio: null,
  cargando: true,
  setSesion: (sesion) => set({ sesion }),
  setNegocio: (negocio) => set({ negocio }),
  setCargando: (cargando) => set({ cargando }),
  reset: () => set({ sesion: null, negocio: null }),
}));
