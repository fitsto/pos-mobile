/**
 * Utilidades para RUT chileno.
 * Formato canónico: "12345678-9" (sin puntos, con guión, DV mayúscula).
 *
 * Port directo desde api-store (`src/contexts/common/domain/rut.ts`)
 * pero usando `Error` plano para no depender de DomainError en el móvil.
 */

const RUT_REGEX_INPUT = /^[0-9]{1,8}-?[0-9kK]$/;

/** Limpia puntos y espacios; asegura guión antes del DV. No valida el DV. */
export function normalizarRut(rutRaw: string): string {
  if (!rutRaw) throw new Error('RUT vacío');
  const limpio = rutRaw.replace(/\./g, '').replace(/\s/g, '').toUpperCase();
  const conGuion = limpio.includes('-')
    ? limpio
    : limpio.length >= 2
      ? `${limpio.slice(0, -1)}-${limpio.slice(-1)}`
      : limpio;
  if (!RUT_REGEX_INPUT.test(conGuion)) {
    throw new Error(`RUT con formato inválido: "${rutRaw}"`);
  }
  return conGuion;
}

/** Calcula el dígito verificador (mod 11). */
export function calcularDv(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

/** Valida y devuelve el RUT normalizado. Lanza Error si el DV es inválido. */
export function validarRut(rutRaw: string): string {
  const normalizado = normalizarRut(rutRaw);
  const [cuerpo, dv] = normalizado.split('-');
  if (!cuerpo || !dv) throw new Error('RUT incompleto');
  const dvEsperado = calcularDv(cuerpo);
  if (dvEsperado !== dv.toUpperCase()) {
    throw new Error(`RUT inválido: DV no coincide (esperado ${dvEsperado})`);
  }
  return `${cuerpo}-${dv.toUpperCase()}`;
}

/**
 * Formatea un RUT mientras el usuario tipea: agrega puntos cada 3 dígitos del
 * cuerpo y un guión antes del DV. Acepta entrada parcial (no exige DV).
 *
 * Reglas:
 *   - Sólo se agrega `-DV` cuando el usuario realmente escribió un DV. Para
 *     decidir eso usamos dos señales: (a) terminó en `K` (DV explícito), o
 *     (b) ya escribió 9 caracteres (8 cuerpo + DV).
 *   - Mientras el cuerpo todavía esté en construcción (≤ 8 dígitos sin K),
 *     mostramos sólo dígitos con puntos, SIN guión. Así, al borrar, no se
 *     "promueve" el último dígito a DV (lo que antes hacía que apareciera
 *     un número distinto al usuario tras un backspace).
 *
 * Ejemplos:
 *   - "12345678"  → "12.345.678"        (cuerpo en construcción)
 *   - "123456789" → "12.345.678-9"      (DV detectado por largo)
 *   - "12345678K" → "12.345.678-K"      (DV detectado por la K)
 */
export function formatearRutInput(raw: string): string {
  if (!raw) return '';
  // Sólo dígitos y K, todo en mayúsculas; el resto (incluido el guión) se
  // descarta — lo regeneramos nosotros si corresponde.
  const limpio = raw.toUpperCase().replace(/[^0-9K]/g, '');
  if (limpio.length === 0) return '';

  const terminaEnK = limpio.endsWith('K');
  const tieneDv = terminaEnK || limpio.length >= 9;

  if (!tieneDv) {
    // Cuerpo en construcción: sólo agrupar dígitos con puntos.
    const soloDigitos = limpio.replace(/[^0-9]/g, '').slice(0, 8);
    if (soloDigitos.length === 0) return '';
    return soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // Cuerpo + DV. Limitamos cuerpo a 8 dígitos (RUT chileno max).
  const cuerpoBruto = limpio.slice(0, -1).replace(/[^0-9]/g, '').slice(0, 8);
  const dv = limpio.slice(-1);
  if (cuerpoBruto.length === 0) return dv;
  const cuerpoConPuntos = cuerpoBruto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpoConPuntos}-${dv}`;
}

/** Versión no-throw. */
export function esRutValido(rutRaw: string): boolean {
  try {
    validarRut(rutRaw);
    return true;
  } catch {
    return false;
  }
}
