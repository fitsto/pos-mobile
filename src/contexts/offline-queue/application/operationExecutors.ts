import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import type { OperationExecutor } from './SyncOfflineQueueUseCase';

/**
 * Ejecuta un ajuste de stock encolado. El payload contiene los mismos campos
 * que envía `HttpAjusteInventarioRepository.registrar` + `clientMovimientoId`.
 * El backend es idempotente: reenvíos con el mismo id no duplican.
 */
export const ajusteStockExecutor: OperationExecutor = async (op, token) => {
  await httpClient.post(
    `/tiendas/${op.negocioId}/ajustes-inventario`,
    {
      ...op.payload,
      clientMovimientoId: op.id,
    },
    { token },
  );
};

/**
 * Ejecuta una transferencia encolada. Necesita dos UUIDs cliente (salida +
 * entrada). Se derivan determinísticamente del id raíz `op.id` para que un
 * reintento posterior produzca los mismos ids y golpee la unicidad idempotente.
 */
/**
 * Ejecuta una venta presencial encolada. El payload contiene todo el body de
 * `POST /tiendas/:organizationId/ventas` + `clientVentaId`. Se usa el id del
 * PendingOperation como idempotency key → reintentos no duplican la venta.
 */
export const ventaPresencialExecutor: OperationExecutor = async (op, token) => {
  await httpClient.post(
    `/tiendas/${op.negocioId}/ventas`,
    {
      ...op.payload,
      clientVentaId: op.id,
    },
    { token },
  );
};

export const transferirStockExecutor: OperationExecutor = async (op, token) => {
  const payload = op.payload as Record<string, unknown> & {
    clientMovimientoIdSalida?: string;
    clientMovimientoIdEntrada?: string;
  };

  // Los dos ids ya vienen precomputados al encolar (ver enqueueTransferirStock).
  await httpClient.post(
    `/tiendas/${op.negocioId}/ajustes-inventario/transferencias`,
    payload,
    { token },
  );
};
