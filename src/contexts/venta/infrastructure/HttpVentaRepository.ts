import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import type { MedioPago } from '../domain/MedioPago';
import type {
  CanalVenta,
  VentaCreada,
  VentaDetalle,
  VentaResumen,
} from '../domain/Venta';
import type {
  CrearVentaParams,
  ListarVentasParams,
  ListarVentasResultado,
  VentaRepository,
} from '../domain/VentaRepository';

interface ApiVentaResponse {
  id: string;
  fechaHora: string;
  totalBruto: number;
  medioPago: MedioPago;
  montoRecibido: number | null;
  vuelto: number | null;
}

interface ApiVentaResumen {
  id: string;
  fechaHora: string;
  totalBruto: number;
  totalNeto: number;
  medioPago: MedioPago;
  canal: CanalVenta;
  ubicacionId: string;
  ubicacionNombre: string | null;
  montoRecibido: number | null;
  vuelto: number | null;
  detalles?: { id: string }[];
}

interface ApiVentaListado {
  items: ApiVentaResumen[];
  total: number;
  page: number;
  pageSize: number;
}

interface ApiVentaDetalleItem {
  id: string;
  productoId: string;
  productoNombre: string;
  productoImagenUrl: string | null;
  cantidad: number;
  precioVentaFinalUnitario: number;
  totalBruto: number;
}

interface ApiVentaDetalle {
  id: string;
  fechaHora: string;
  totalBruto: number;
  totalNeto: number;
  totalImpuesto: number;
  medioPago: MedioPago;
  canal: CanalVenta;
  ubicacionId: string;
  ubicacionNombre: string | null;
  usuarioId: string | null;
  clienteNombre: string | null;
  clienteRut: string | null;
  montoRecibido: number | null;
  vuelto: number | null;
  detalles: ApiVentaDetalleItem[];
}

export class HttpVentaRepository implements VentaRepository {
  async crear(params: CrearVentaParams): Promise<VentaCreada> {
    // customerId tiene prioridad sobre clienteData — nunca enviamos los dos.
    const clienteFields = params.customerId
      ? { customerId: params.customerId }
      : params.clienteData
        ? { clienteData: params.clienteData }
        : {};
    const res = await httpClient.post<ApiVentaResponse>(
      `/tiendas/${params.negocioId}/ventas`,
      {
        ubicacionId: params.ubicacionId,
        medioPago: params.medioPago,
        canal: 'PRESENCIAL',
        items: params.items,
        ...(params.montoRecibido !== undefined && { montoRecibido: params.montoRecibido }),
        ...clienteFields,
      },
      { token: params.token },
    );
    return {
      id: res.id,
      fechaHora: res.fechaHora,
      totalBruto: res.totalBruto,
      medioPago: res.medioPago,
      montoRecibido: res.montoRecibido,
      vuelto: res.vuelto,
    };
  }

  async listar(params: ListarVentasParams): Promise<ListarVentasResultado> {
    const qs = new URLSearchParams();
    if (params.ubicacionId) qs.set('ubicacionId', params.ubicacionId);
    if (params.canal) qs.set('canal', params.canal);
    if (params.medioPago) qs.set('medioPago', params.medioPago);
    if (params.desde) qs.set('desde', params.desde);
    if (params.hasta) qs.set('hasta', params.hasta);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    const raw = await httpClient.get<ApiVentaListado>(
      `/tiendas/${params.negocioId}/ventas?${qs.toString()}`,
      { token: params.token },
    );
    const items: VentaResumen[] = raw.items.map((v) => ({
      id: v.id,
      fechaHora: v.fechaHora,
      totalBruto: Number(v.totalBruto),
      totalNeto: Number(v.totalNeto),
      medioPago: v.medioPago,
      canal: v.canal,
      ubicacionId: v.ubicacionId,
      ubicacionNombre: v.ubicacionNombre,
      montoRecibido: v.montoRecibido != null ? Number(v.montoRecibido) : null,
      vuelto: v.vuelto != null ? Number(v.vuelto) : null,
      cantidadItems: v.detalles?.length ?? 0,
    }));
    return { items, total: raw.total, page: raw.page, pageSize: raw.pageSize };
  }

  async obtenerPorId({
    negocioId,
    ventaId,
    token,
  }: {
    negocioId: string;
    ventaId: string;
    token: string;
  }): Promise<VentaDetalle> {
    const raw = await httpClient.get<ApiVentaDetalle>(
      `/tiendas/${negocioId}/ventas/${ventaId}`,
      { token },
    );
    return {
      id: raw.id,
      fechaHora: raw.fechaHora,
      totalBruto: Number(raw.totalBruto),
      totalNeto: Number(raw.totalNeto),
      totalImpuesto: Number(raw.totalImpuesto),
      medioPago: raw.medioPago,
      canal: raw.canal,
      ubicacionId: raw.ubicacionId,
      ubicacionNombre: raw.ubicacionNombre,
      usuarioId: raw.usuarioId,
      clienteNombre: raw.clienteNombre ?? null,
      clienteRut: raw.clienteRut ?? null,
      montoRecibido: raw.montoRecibido != null ? Number(raw.montoRecibido) : null,
      vuelto: raw.vuelto != null ? Number(raw.vuelto) : null,
      detalles: raw.detalles.map((d) => ({
        id: d.id,
        productoId: d.productoId,
        productoNombre: d.productoNombre,
        productoImagenUrl: d.productoImagenUrl,
        cantidad: Number(d.cantidad),
        precioVentaFinalUnitario: Number(d.precioVentaFinalUnitario),
        totalBruto: Number(d.totalBruto),
      })),
    };
  }
}
