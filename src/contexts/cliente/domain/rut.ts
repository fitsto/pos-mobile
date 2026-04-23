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

/** Versión no-throw. */
export function esRutValido(rutRaw: string): boolean {
  try {
    validarRut(rutRaw);
    return true;
  } catch {
    return false;
  }
}
