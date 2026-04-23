export function formatCLP(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CL')}`;
}
