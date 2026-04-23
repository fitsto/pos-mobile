import type { Ubicacion } from './Ubicacion';

export interface UbicacionRepository {
  listar(input: { negocioId: string; token: string }): Promise<Ubicacion[]>;
}
