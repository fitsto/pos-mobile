import type { Cliente } from '../domain/Cliente';
import type { ClienteRepository } from '../domain/ClienteRepository';
import { validarRut } from '../domain/rut';

export interface BuscarClientePorRutInput {
  negocioId: string;
  rut: string;
  token: string;
}

export class BuscarClientePorRutUseCase {
  constructor(private readonly repo: ClienteRepository) {}

  async execute(input: BuscarClientePorRutInput): Promise<Cliente | null> {
    // Valida + normaliza antes de pegarle al backend. Si el RUT no es válido
    // lanza Error y el caller decide cómo mostrarlo.
    const rutNormalizado = validarRut(input.rut);
    return this.repo.lookupPorRut({
      negocioId: input.negocioId,
      rut: rutNormalizado,
      token: input.token,
    });
  }
}
