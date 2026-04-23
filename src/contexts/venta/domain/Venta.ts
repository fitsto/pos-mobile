import type { MedioPago } from './MedioPago';

export type CanalVenta = 'PRESENCIAL' | 'ONLINE';

export interface VentaCreada {
  id: string;
  fechaHora: string;
  totalBruto: number;
  medioPago: MedioPago;
  montoRecibido: number | null;
  vuelto: number | null;
}

/** Fila de historial (listado). */
export interface VentaResumen {
  id: string;
  fechaHora: string;
  totalBruto: number;
  totalNeto: number;
  medioPago: MedioPago;
  canal: CanalVenta;
  ubicacionId: string;
  ubicacionNombre: string | null;
  montoRecibido: number | null;
  vuelto: number | null;
  cantidadItems: number;
}

export interface VentaDetalleItem {
  id: string;
  productoId: string;
  productoNombre: string;
  productoImagenUrl: string | null;
  cantidad: number;
  precioVentaFinalUnitario: number;
  totalBruto: number;
}

/** Detalle completo para la pantalla de una venta puntual. */
export interface VentaDetalle {
  id: string;
  fechaHora: string;
  totalBruto: number;
  totalNeto: number;
  totalImpuesto: number;
  medioPago: MedioPago;
  canal: CanalVenta;
  ubicacionId: string;
  ubicacionNombre: string | null;
  usuarioId: string | null;
  montoRecibido: number | null;
  vuelto: number | null;
  detalles: VentaDetalleItem[];
}
