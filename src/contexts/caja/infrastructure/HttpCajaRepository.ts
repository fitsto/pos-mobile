import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import { Caja, type CajaData } from '../domain/Caja';
import type {
  AbrirCajaParams,
  CajaActualResult,
  CajaRepository,
  CerrarCajaParams,
  MovimientoParams,
} from '../domain/CajaRepository';
import type { MovimientoCajaData } from '../domain/MovimientoCaja';

interface ApiCaja {
  id: string;
  negocioId: string;
  ubicacionId: string;
  estado: 'ABIERTA' | 'CERRADA';
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

const toCaja = (a: ApiCaja): Caja => Caja.create(a as CajaData);

export class HttpCajaRepository implements CajaRepository {
  async obtenerActual({ negocioId, ubicacionId, token }: {
    negocioId: string; ubicacionId: string; token: string;
  }): Promise<CajaActualResult> {
    const res = await httpClient.get<{
      caja: ApiCaja | null;
      movimientos: MovimientoCajaData[];
      saldo: number;
    }>(`/tiendas/${negocioId}/cajas/actual?ubicacionId=${ubicacionId}`, { token });
    return {
      caja: res.caja ? toCaja(res.caja) : null,
      movimientos: res.movimientos,
      saldo: res.saldo,
    };
  }

  async abrir(p: AbrirCajaParams): Promise<Caja> {
    const res = await httpClient.post<ApiCaja>(
      `/tiendas/${p.negocioId}/cajas`,
      {
        ubicacionId: p.ubicacionId,
        montoApertura: p.montoApertura,
        ...(p.observaciones ? { observaciones: p.observaciones } : {}),
      },
      { token: p.token },
    );
    return toCaja(res);
  }

  async cerrar(p: CerrarCajaParams): Promise<Caja> {
    const res = await httpClient.post<ApiCaja>(
      `/tiendas/${p.negocioId}/cajas/${p.cajaId}/cerrar`,
      {
        montoDeclarado: p.montoDeclarado,
        ...(p.observaciones ? { observaciones: p.observaciones } : {}),
      },
      { token: p.token },
    );
    return toCaja(res);
  }

  async registrarMovimiento(p: MovimientoParams): Promise<MovimientoCajaData> {
    const res = await httpClient.post<MovimientoCajaData>(
      `/tiendas/${p.negocioId}/cajas/${p.cajaId}/movimientos`,
      {
        tipo: p.tipo,
        monto: p.monto,
        ...(p.descripcion ? { descripcion: p.descripcion } : {}),
      },
      { token: p.token },
    );
    return res;
  }
}
