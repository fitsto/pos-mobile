/**
 * Desglose de un precio final (con IVA) en neto / impuesto / ganancia.
 *
 * Convenciones:
 *   - `precioFinal` y `costoNeto` son números enteros en CLP.
 *   - `ivaPorcentaje` viene del negocio (ej: 19).
 *   - `margenPorcentaje` se calcula sobre el **costo** (markup chileno típico):
 *       margen = ganancia / costo × 100
 *     Si el costo es 0, devolvemos `null` para no mostrar "Infinity%".
 *
 * Todo vive en utils para mantener la tab Info limpia y facilitar tests
 * cuando queramos cubrir los casos de borde.
 */
export interface DesglosePrecio {
  /** Precio final que paga el cliente (con IVA). */
  precioFinal: number;
  /** Precio sin IVA. */
  precioNeto: number;
  /** Monto del IVA incluido en el precio final. */
  ivaMonto: number;
  /** Ganancia = precioNeto − costoNeto. Puede ser negativa. */
  ganancia: number;
  /** Margen sobre costo, en %. null si costo=0 (no calculable). */
  margenPorcentaje: number | null;
}

export function desglosarPrecio(
  precioFinal: number,
  costoNeto: number,
  ivaPorcentaje: number,
): DesglosePrecio {
  const factor = 1 + ivaPorcentaje / 100;
  const precioNeto = precioFinal / factor;
  const ivaMonto = precioFinal - precioNeto;
  const ganancia = precioNeto - costoNeto;
  const margenPorcentaje =
    costoNeto > 0 ? (ganancia / costoNeto) * 100 : null;

  return {
    precioFinal,
    precioNeto: Math.round(precioNeto),
    ivaMonto: Math.round(ivaMonto),
    ganancia: Math.round(ganancia),
    margenPorcentaje,
  };
}
