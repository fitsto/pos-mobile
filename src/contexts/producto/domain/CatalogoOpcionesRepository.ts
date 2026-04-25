import type { Categoria, Marca } from './Categoria';

export interface ListarParams {
  negocioId: string;
  token: string;
}

export interface CrearOpcionParams {
  negocioId: string;
  token: string;
  nombre: string;
}

/**
 * Repositorio de "lookups" de catálogo: categorías y marcas del negocio.
 * Permite listarlas para los pickers del wizard y crear nuevas on-the-fly
 * cuando el usuario las necesita pero todavía no existen.
 */
export interface CatalogoOpcionesRepository {
  listarCategorias(params: ListarParams): Promise<Categoria[]>;
  listarMarcas(params: ListarParams): Promise<Marca[]>;
  crearCategoria(params: CrearOpcionParams): Promise<Categoria>;
  crearMarca(params: CrearOpcionParams): Promise<Marca>;
}
