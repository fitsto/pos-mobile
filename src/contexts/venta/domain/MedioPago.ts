export const MedioPago = {
  EFECTIVO: 'EFECTIVO',
  DEBITO: 'DEBITO',
  CREDITO: 'CREDITO',
  TRANSFERENCIA: 'TRANSFERENCIA',
} as const;

export type MedioPago = (typeof MedioPago)[keyof typeof MedioPago];

export const MEDIOS_PAGO_PRESENCIAL: MedioPago[] = [
  MedioPago.EFECTIVO,
  MedioPago.DEBITO,
  MedioPago.CREDITO,
  MedioPago.TRANSFERENCIA,
];
