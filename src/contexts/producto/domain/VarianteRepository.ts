import type { Modelo, Variante } from './Variante';

export interface ListarVariantesParams {
  negocioId: string;
  productoId: string;
  token: string;
}

export interface VarianteRepository {
  listarVariantes(p: ListarVariantesParams): Promise<Variante[]>;
  listarModelos(p: ListarVariantesParams): Promise<Modelo[]>;
}
