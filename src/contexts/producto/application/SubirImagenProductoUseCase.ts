import type { Producto } from '../domain/Producto';
import type { ProductoRepository } from '../domain/ProductoRepository';

export interface SubirImagenProductoInput {
  negocioId: string;
  productoId: string;
  token: string;
  /** URI local (file://...) que expo-image-picker devuelve. */
  localUri: string;
  /** Content-type de la imagen; default image/jpeg. */
  contentType?: string;
}

/**
 * Orquesta el flujo de 3 pasos para subir una imagen:
 *   1. Pedir signed URL al backend.
 *   2. PUT directo del binario al storage con esa URL.
 *   3. Confirmar en el backend para persistir el `path` en el producto.
 *
 * Se modela como use case para que las pantallas no tengan que conocer el
 * orden ni tocar `fetch` directamente.
 */
export class SubirImagenProductoUseCase {
  constructor(private readonly repo: ProductoRepository) {}

  async execute({
    negocioId,
    productoId,
    token,
    localUri,
    contentType = 'image/jpeg',
  }: SubirImagenProductoInput): Promise<Producto> {
    const { signedUrl, path } = await this.repo.generarSignedUrl({
      negocioId,
      productoId,
      token,
      contentType,
    });

    // PUT directo al storage. No pasa por HttpClient porque el signedUrl es
    // un dominio externo (S3/R2) y no necesita nuestro Bearer ni el JSON.
    const blob = await (await fetch(localUri)).blob();
    const res = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!res.ok) {
      throw new Error(`No se pudo subir la imagen (HTTP ${res.status})`);
    }

    return this.repo.confirmarImagen({ negocioId, productoId, token, path });
  }
}
