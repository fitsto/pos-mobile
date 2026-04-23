import type { Producto } from './Producto';

export interface BuscarProductoParams {
  negocioId: string;
  query: string;
  token: string;
  /** Si se pasa, solo devuelve productos con stock > 0 en esa ubicación. */
  ubicacionId?: string;
}

export interface ProductoRepository {
  buscar(params: BuscarProductoParams): Promise<Producto[]>;
}
