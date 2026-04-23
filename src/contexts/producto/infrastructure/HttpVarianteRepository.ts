import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import type { Modelo, Variante } from '../domain/Variante';
import type { ListarVariantesParams, VarianteRepository } from '../domain/VarianteRepository';

interface ApiVariante {
  id: string;
  productoId: string;
  modeloId: string | null;
  talla: string | null;
  sku: string | null;
  codigoBarra: string | null;
  costoNeto: number | null;
  precioVentaFinal: number | null;
  precioVentaNeto: number | null;
  orden: number;
  activo: boolean;
}

interface ApiModelo {
  id: string;
  nombre: string;
  imagenUrl: string | null;
  orden: number;
  activo: boolean;
}

export class HttpVarianteRepository implements VarianteRepository {
  async listarVariantes({ negocioId, productoId, token }: ListarVariantesParams): Promise<Variante[]> {
    const raw = await httpClient.get<ApiVariante[]>(
      `/tiendas/${negocioId}/productos/${productoId}/variantes`,
      { token },
    );
    return raw.map((v) => ({
      id: v.id,
      productoId: v.productoId,
      modeloId: v.modeloId,
      talla: v.talla,
      sku: v.sku,
      codigoBarra: v.codigoBarra,
      costoNeto: v.costoNeto != null ? Number(v.costoNeto) : null,
      precioVentaFinal: v.precioVentaFinal != null ? Number(v.precioVentaFinal) : null,
      precioVentaNeto: v.precioVentaNeto != null ? Number(v.precioVentaNeto) : null,
      orden: v.orden,
      activo: v.activo,
    }));
  }

  async listarModelos({ negocioId, productoId, token }: ListarVariantesParams): Promise<Modelo[]> {
    const raw = await httpClient.get<ApiModelo[]>(
      `/tiendas/${negocioId}/productos/${productoId}/modelos`,
      { token },
    );
    return raw.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      imagenUrl: m.imagenUrl,
      orden: m.orden,
      activo: m.activo,
    }));
  }
}
