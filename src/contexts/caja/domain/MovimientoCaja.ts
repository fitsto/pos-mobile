import type { TipoMovimientoCaja } from './types';

export interface MovimientoCajaData {
  id: string;
  cajaId: string;
  tipo: TipoMovimientoCaja;
  monto: number;
  descripcion: string | null;
  usuarioId: string;
  ventaId: string | null;
  createdAt: string;
}
