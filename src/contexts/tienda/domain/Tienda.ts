export type RolTienda = 'ADMIN' | 'GERENTE' | 'VENDEDOR';

export interface TiendaData {
  id: string;
  nombre: string;
  rol: RolTienda;
  ubicacionId: string | null;
  ubicacionNombre: string | null;
  usarControlCaja: boolean;
}

export class Tienda {
  private constructor(private readonly data: TiendaData) {}

  static create(data: TiendaData): Tienda {
    if (!data.id) throw new Error('Tienda requiere id');
    if (data.rol === 'VENDEDOR' && !data.ubicacionId) {
      throw new Error('Un VENDEDOR debe tener ubicación asignada');
    }
    return new Tienda(data);
  }

  get id(): string { return this.data.id; }
  get nombre(): string { return this.data.nombre; }
  get rol(): RolTienda { return this.data.rol; }
  get ubicacionId(): string | null { return this.data.ubicacionId; }
  get ubicacionNombre(): string | null { return this.data.ubicacionNombre; }
  get usarControlCaja(): boolean { return this.data.usarControlCaja; }

  get esVendedor(): boolean { return this.data.rol === 'VENDEDOR'; }
  get puedeGestionarStock(): boolean { return this.data.rol !== 'VENDEDOR'; }

  toJSON(): TiendaData { return { ...this.data }; }
}
