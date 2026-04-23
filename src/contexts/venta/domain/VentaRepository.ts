import type { MedioPago } from './MedioPago';
import type { VentaCreada, VentaDetalle, VentaResumen, CanalVenta } from './Venta';

export interface CrearVentaItem {
  productoId: string;
  cantidad: number;
  varianteId?: string | null;
}

/**
 * Datos para registrar un cliente al vuelo junto con la venta.
 * El backend hace upsert idempotente por (organizationId, rut) o (organizationId, email).
 */
export interface ClienteDataInput {
  name: string;
  email?: string;
  rut?: string;
  telefono?: string;
}

export interface CrearVentaParams {
  negocioId: string;
  ubicacionId: string;
  medioPago: MedioPago;
  items: CrearVentaItem[];
  montoRecibido?: number;
  token: string;
  /** Cliente ya identificado (lookup previo). */
  customerId?: string;
  /** Alternativa: datos para registrar al vuelo. Nunca enviar ambos. */
  clienteData?: ClienteDataInput;
}

export interface ListarVentasParams {
  negocioId: string;
  token: string;
  ubicacionId?: string;
  canal?: CanalVenta;
  medioPago?: MedioPago;
  desde?: string;
  hasta?: string;
  page?: number;
  pageSize?: number;
}

export interface ListarVentasResultado {
  items: VentaResumen[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VentaRepository {
  crear(params: CrearVentaParams): Promise<VentaCreada>;
  listar(params: ListarVentasParams): Promise<ListarVentasResultado>;
  obtenerPorId(params: { negocioId: string; ventaId: string; token: string }): Promise<VentaDetalle>;
}
