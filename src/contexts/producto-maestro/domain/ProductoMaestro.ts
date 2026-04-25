/**
 * Registro del catálogo global (cross-tienda) de productos.
 * Se usa sólo como sugerencia para precargar el formulario de "nuevo producto".
 */
export interface ProductoMaestro {
  codigoBarras: string;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  imagenUrl: string | null;
  source: string;
  sourceUrl: string | null;
}
