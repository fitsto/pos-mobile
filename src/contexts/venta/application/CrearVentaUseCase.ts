import { DomainError } from '../../shared/domain/DomainError';
import type { Carrito } from '../domain/Carrito';
import type { MedioPago } from '../domain/MedioPago';
import { MedioPago as MP } from '../domain/MedioPago';
import type { VentaCreada } from '../domain/Venta';
import type { ClienteDataInput, VentaRepository } from '../domain/VentaRepository';

export interface CrearVentaInput {
  negocioId: string;
  ubicacionId: string;
  carrito: Carrito;
  medioPago: MedioPago;
  montoRecibido?: number;
  token: string;
  /** Cliente ya identificado (lookup previo por RUT). Preferido sobre clienteData. */
  customerId?: string;
  /** Datos del cliente para upsert al vuelo. Se ignora si hay customerId. */
  clienteData?: ClienteDataInput;
}

export class CrearVentaUseCase {
  constructor(private readonly repo: VentaRepository) {}

  async execute(input: CrearVentaInput): Promise<VentaCreada> {
    if (input.carrito.vacio) throw new DomainError('El carrito está vacío');
    if (input.medioPago === MP.EFECTIVO) {
      if (input.montoRecibido === undefined) {
        throw new DomainError('Debes indicar el monto recibido en efectivo');
      }
      // valida y lanza si es insuficiente
      input.carrito.calcularVuelto(input.montoRecibido);
    }
    return this.repo.crear({
      negocioId: input.negocioId,
      ubicacionId: input.ubicacionId,
      medioPago: input.medioPago,
      montoRecibido: input.medioPago === MP.EFECTIVO ? input.montoRecibido : undefined,
      items: input.carrito.items.map((i) => ({
        productoId: i.producto.id,
        cantidad: i.cantidad,
        ...(i.variante ? { varianteId: i.variante.id } : {}),
      })),
      token: input.token,
      // Cliente: prioridad customerId > clienteData. Nunca ambos.
      ...(input.customerId
        ? { customerId: input.customerId }
        : input.clienteData
          ? { clienteData: input.clienteData }
          : {}),
    });
  }
}
