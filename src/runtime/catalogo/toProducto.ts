import { Producto } from '../../contexts/producto/domain/Producto';
import type { CatalogoProducto } from '../../contexts/catalogo-local/domain/CatalogoSnapshot';

/**
 * Adapta un `CatalogoProducto` (DTO del catálogo local sqlite, "frío") a
 * la entidad `Producto` que esperan los handlers del POS y el carrito.
 *
 * Vive acá (runtime/catalogo) y no en el contexto de producto porque
 * `CatalogoProducto` es de otro contexto (catalogo-local) y no queremos
 * acoplar `producto/domain` a su DTO.
 */
export function toProducto(p: CatalogoProducto): Producto {
    return Producto.create({
        id: p.id,
        nombre: p.nombre,
        descripcion: null,
        codigoBarras: p.codigoBarra,
        sku: p.codigoInterno,
        costoNetoUnitario: 0,
        precioVentaFinalUnitario: p.precioVentaFinal,
        precioVentaNetoUnitario: p.precioVentaFinal,
        precioOferta: p.precioOferta,
        imagenes: [],
        imagenUrl: p.imagenUrl ?? null,
        activo: p.activo,
    });
}
