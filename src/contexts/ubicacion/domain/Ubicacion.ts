export type TipoUbicacion = 'SUCURSAL' | 'BODEGA';

export interface UbicacionData {
  id: string;
  nombre: string;
  tipo: TipoUbicacion;
  esPrincipal: boolean;
}

export class Ubicacion {
  private constructor(private readonly data: UbicacionData) {}

  static create(data: UbicacionData): Ubicacion {
    if (!data.id) throw new Error('Ubicacion requiere id');
    return new Ubicacion(data);
  }

  get id(): string { return this.data.id; }
  get nombre(): string { return this.data.nombre; }
  get tipo(): TipoUbicacion { return this.data.tipo; }
  get esPrincipal(): boolean { return this.data.esPrincipal; }

  toJSON(): UbicacionData { return { ...this.data }; }
}
