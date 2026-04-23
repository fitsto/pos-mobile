import { create } from 'zustand';
import { Carrito } from '../../contexts/venta/domain/Carrito';
import type { VarianteInfo } from '../../contexts/venta/domain/ItemCarrito';
import type { Producto } from '../../contexts/producto/domain/Producto';

interface CarritoState {
  carrito: Carrito;
  version: number; // para forzar re-render tras mutación
  agregar: (p: Producto, cantidad?: number, variante?: VarianteInfo | null) => void;
  quitar: (productoId: string, varianteId?: string | null) => void;
  setCantidad: (productoId: string, cantidad: number, varianteId?: string | null) => void;
  vaciar: () => void;
}

export const useCarritoStore = create<CarritoState>((set, get) => ({
  carrito: new Carrito(),
  version: 0,
  agregar: (p, cantidad = 1, variante = null) => {
    get().carrito.agregar(p, cantidad, variante);
    set({ version: get().version + 1 });
  },
  quitar: (productoId, varianteId = null) => {
    get().carrito.quitar(productoId, varianteId);
    set({ version: get().version + 1 });
  },
  setCantidad: (productoId, cantidad, varianteId = null) => {
    get().carrito.setCantidad(productoId, cantidad, varianteId);
    set({ version: get().version + 1 });
  },
  vaciar: () => {
    get().carrito.vaciar();
    set({ version: get().version + 1 });
  },
}));
