import type { MotivoAjuste } from './MotivoAjuste';

export interface RegistrarAjusteParams {
  negocioId: string;
  productoId: string;
  varianteId?: string | null;
  ubicacionId: string;
  cantidad: number; // + entrada, - salida, nunca 0
  motivo: MotivoAjuste;
  comentario?: string;
  token: string;
}

export interface MovimientoInventarioData {
  id: string;
  productoId: string;
  ubicacionId: string;
  tipo: string;
  motivo: string | null;
  cantidad: number;
  createdAt: string;
}

export interface AjusteInventarioRepository {
  registrar(p: RegistrarAjusteParams): Promise<MovimientoInventarioData>;
}
