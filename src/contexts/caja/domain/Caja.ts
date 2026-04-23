import type { EstadoCaja } from './types';

export interface CajaData {
  id: string;
  negocioId: string;
  ubicacionId: string;
  estado: EstadoCaja;
  abiertaPorId: string;
  cerradaPorId: string | null;
  montoApertura: number;
  montoDeclarado: number | null;
  montoEsperado: number | null;
  diferencia: number | null;
  fechaApertura: string;
  fechaCierre: string | null;
  observaciones: string | null;
}

export class Caja {
  private constructor(private readonly data: CajaData) {}

  static create(data: CajaData): Caja {
    if (!data.id) throw new Error('Caja requiere id');
    return new Caja(data);
  }

  get id(): string { return this.data.id; }
  get estado(): EstadoCaja { return this.data.estado; }
  get montoApertura(): number { return this.data.montoApertura; }
  get montoDeclarado(): number | null { return this.data.montoDeclarado; }
  get montoEsperado(): number | null { return this.data.montoEsperado; }
  get diferencia(): number | null { return this.data.diferencia; }
  get fechaApertura(): string { return this.data.fechaApertura; }
  get fechaCierre(): string | null { return this.data.fechaCierre; }
  get observaciones(): string | null { return this.data.observaciones; }
  get estaAbierta(): boolean { return this.data.estado === 'ABIERTA'; }

  toJSON(): CajaData { return { ...this.data }; }
}
