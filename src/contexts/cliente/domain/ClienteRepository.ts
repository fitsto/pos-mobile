import type { Cliente } from './Cliente';

export interface LookupPorRutParams {
  negocioId: string;
  rut: string;
  token: string;
}

export interface ClienteRepository {
  /** Busca un cliente por RUT. Devuelve null si no existe. */
  lookupPorRut(params: LookupPorRutParams): Promise<Cliente | null>;
}
