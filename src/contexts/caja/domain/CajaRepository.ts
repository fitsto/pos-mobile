import type { Caja } from './Caja';
import type { MovimientoCajaData } from './MovimientoCaja';
import type { TipoMovimientoCaja } from './types';

export interface CajaActualResult {
  caja: Caja | null;
  movimientos: MovimientoCajaData[];
  saldo: number;
}

export interface AbrirCajaParams {
  negocioId: string;
  ubicacionId: string;
  montoApertura: number;
  observaciones?: string | null;
  token: string;
}

export interface CerrarCajaParams {
  negocioId: string;
  cajaId: string;
  montoDeclarado: number;
  observaciones?: string | null;
  token: string;
}

export interface MovimientoParams {
  negocioId: string;
  cajaId: string;
  tipo: Exclude<TipoMovimientoCaja, 'APERTURA' | 'CIERRE' | 'VENTA_EFECTIVO'>;
  monto: number;
  descripcion?: string | null;
  token: string;
}

export interface CajaRepository {
  obtenerActual(p: { negocioId: string; ubicacionId: string; token: string }): Promise<CajaActualResult>;
  abrir(p: AbrirCajaParams): Promise<Caja>;
  cerrar(p: CerrarCajaParams): Promise<Caja>;
  registrarMovimiento(p: MovimientoParams): Promise<MovimientoCajaData>;
}
