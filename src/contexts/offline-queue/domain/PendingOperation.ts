export type PendingOperationType = 'AJUSTE_STOCK' | 'TRANSFERIR_STOCK' | 'VENTA_PRESENCIAL';

export type PendingOperationStatus = 'pending' | 'syncing' | 'failed';

export interface PendingOperation {
  /** UUID generado en el cliente. Se envía al backend como clientMovimientoId para idempotencia. */
  id: string;
  type: PendingOperationType;
  /** ID del negocio al que pertenece la operación. */
  negocioId: string;
  /** Payload serializable con todos los parámetros requeridos por el endpoint. */
  payload: Record<string, unknown>;
  /** Texto corto para mostrar en la lista de pendientes. */
  label: string;
  createdAt: number;
  attempts: number;
  status: PendingOperationStatus;
  lastError: string | null;
  lastAttemptAt: number | null;
}
