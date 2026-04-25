import type { Categoria, Marca } from './Categoria';

export interface ListarParams {
  negocioId: string;
  token: string;
}

/**
 * Repositorio de "lookups" de catálogo: categorías y marcas del negocio.
 * Se mantiene chico a propósito — son tablas de referencia que el wizard
 * consume para pickers.
 */
export interface CatalogoOpcionesRepository {
  listarCategorias(params: ListarParams): Promise<Categoria[]>;
  listarMarcas(params: ListarParams): Promise<Marca[]>;
}
