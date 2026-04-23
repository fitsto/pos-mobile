import type { Modelo, Variante } from '../domain/Variante';
import type { ListarVariantesParams, VarianteRepository } from '../domain/VarianteRepository';

export interface VariantesDeProducto {
  variantes: Variante[];
  modelos: Modelo[];
}

export class ListarVariantesUseCase {
  constructor(private readonly repo: VarianteRepository) {}

  async execute(params: ListarVariantesParams): Promise<VariantesDeProducto> {
    const variantes = await this.repo.listarVariantes(params);
    const activas = variantes.filter((v) => v.activo);
    if (activas.length === 0) return { variantes: [], modelos: [] };
    // Solo traemos modelos si hay alguna variante con modeloId
    const necesitaModelos = activas.some((v) => v.modeloId);
    const modelos = necesitaModelos ? await this.repo.listarModelos(params) : [];
    return { variantes: activas, modelos };
  }
}
