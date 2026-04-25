import type { ProductoMaestro } from './ProductoMaestro';

export interface BuscarMaestroParams {
  negocioId: string;
  codigoBarras: string;
  token: string;
}

export interface ProductoMaestroRepository {
  buscarPorCodigoBarras(params: BuscarMaestroParams): Promise<ProductoMaestro | null>;
}
