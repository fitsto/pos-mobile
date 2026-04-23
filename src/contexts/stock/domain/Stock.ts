export interface Stock {
  productoId: string;
  ubicacionId: string;
  cantidad: number;
  varianteId: string | null;
  varianteTalla: string | null;
  modeloNombre: string | null;
}
