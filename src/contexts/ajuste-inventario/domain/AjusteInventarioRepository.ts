import type { MotivoAjuste } from './MotivoAjuste';

export interface RegistrarAjusteParams {
  negocioId: string;
  productoId: string;
  varianteId?: string | null;
  ubicacionId: string;
  cantidad: number; // + entrada, - salida, nunca 0
  motivo: MotivoAjuste;
  comentario?: string;
  token: string;
}

export interface MovimientoInventarioData {
  id: string;
  productoId: string;
  varianteId?: string | null;
  ubicacionId: string;
  tipo: string;          // "AJUSTE" | "VENTA"
  motivo: string | null; // sólo si tipo === "AJUSTE"
  cantidad: number;      // signo: + entrada, - salida
  comentario?: string | null;
  createdAt: string;
}

export interface ListarMovimientosParams {
  negocioId: string;
  productoId?: string;
  ubicacionId?: string;
  varianteId?: string;
  tipo?: 'AJUSTE' | 'VENTA';
  motivo?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
  token: string;
}

export interface AjusteInventarioRepository {
  registrar(p: RegistrarAjusteParams): Promise<MovimientoInventarioData>;
  listar(p: ListarMovimientosParams): Promise<MovimientoInventarioData[]>;
}
