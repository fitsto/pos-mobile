export const EstadoCaja = { ABIERTA: 'ABIERTA', CERRADA: 'CERRADA' } as const;
export type EstadoCaja = (typeof EstadoCaja)[keyof typeof EstadoCaja];

export const TipoMovimientoCaja = {
  APERTURA: 'APERTURA',
  CIERRE: 'CIERRE',
  INGRESO_EXTRA: 'INGRESO_EXTRA',
  RETIRO: 'RETIRO',
  AJUSTE: 'AJUSTE',
  VENTA_EFECTIVO: 'VENTA_EFECTIVO',
} as const;
export type TipoMovimientoCaja =
  (typeof TipoMovimientoCaja)[keyof typeof TipoMovimientoCaja];
