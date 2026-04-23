export interface ClienteData {
  id: string;
  name: string;
  email: string | null;
  rut: string | null;
  telefono: string | null;
  totalCompras: number;
  totalFacturado: number;
  ultimaCompraAt: string | null;
  createdAt: string;
}

export class Cliente {
  private constructor(private readonly data: ClienteData) {}

  static create(data: ClienteData): Cliente {
    if (!data.id) throw new Error('Cliente requiere id');
    if (!data.name) throw new Error('Cliente requiere nombre');
    return new Cliente(data);
  }

  get id(): string { return this.data.id; }
  get name(): string { return this.data.name; }
  get email(): string | null { return this.data.email; }
  get rut(): string | null { return this.data.rut; }
  get telefono(): string | null { return this.data.telefono; }
  get totalCompras(): number { return this.data.totalCompras; }
  get totalFacturado(): number { return this.data.totalFacturado; }
  get ultimaCompraAt(): string | null { return this.data.ultimaCompraAt; }
  get createdAt(): string { return this.data.createdAt; }

  toJSON(): ClienteData { return { ...this.data }; }
}
