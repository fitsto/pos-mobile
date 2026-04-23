import type { Tienda } from './Tienda';

export interface TiendaRepository {
  listarMisNegocios(token: string): Promise<Tienda[]>;
}
