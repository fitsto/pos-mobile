import { httpClient } from '../../shared/infrastructure/http/HttpClient';
import { Cliente } from '../domain/Cliente';
import type { ClienteRepository, LookupPorRutParams } from '../domain/ClienteRepository';

interface ApiCliente {
  id: string;
  name: string;
  email: string | null;
  rut: string | null;
  telefono: string | null;
  totalCompras: number | string;
  totalFacturado: number | string;
  ultimaCompraAt: string | null;
  createdAt: string;
}

export class HttpClienteRepository implements ClienteRepository {
  async lookupPorRut({ negocioId, rut, token }: LookupPorRutParams): Promise<Cliente | null> {
    const qs = new URLSearchParams({ rut });
    const raw = await httpClient.get<ApiCliente | null>(
      `/tiendas/${negocioId}/clientes/lookup?${qs.toString()}`,
      { token },
    );
    if (!raw) return null;
    return Cliente.create({
      id: raw.id,
      name: raw.name,
      email: raw.email,
      rut: raw.rut,
      telefono: raw.telefono,
      totalCompras: Number(raw.totalCompras) || 0,
      totalFacturado: Number(raw.totalFacturado) || 0,
      ultimaCompraAt: raw.ultimaCompraAt,
      createdAt: raw.createdAt,
    });
  }
}
