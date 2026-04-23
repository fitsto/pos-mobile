import { httpClient, identityClient } from '../../shared/infrastructure/http/HttpClient';
import { Tienda, type RolTienda } from '../domain/Tienda';
import type { TiendaRepository } from '../domain/TiendaRepository';

/** Shape del plugin `organization` de Better Auth en identity-central. */
interface IdentityOrganization {
  id:   string;
  name: string;
}

interface ApiNegocioDetalle {
  id: string;
  nombre: string;
  usarControlCaja: boolean;
}

interface ApiMiembroMe {
  id: string;
  negocioId: string;
  rol: RolTienda;
  ubicacionId: string | null;
}

interface ApiUbicacion {
  id: string;
  nombre: string;
}

export class HttpTiendaRepository implements TiendaRepository {
  async listarMisNegocios(token: string): Promise<Tienda[]> {
    // Lista de orgs del usuario: identity-central (source of truth).
    // El `token` acá es el JWT; identity-central lo acepta en el bearer endpoint.
    const negocios = await identityClient.get<IdentityOrganization[]>(
      '/api/auth/organization/list',
      { token },
    );

    const resultados = await Promise.all(
      negocios.map(async (n) => {
        try {
          const miembro = await httpClient.get<ApiMiembroMe>(
            `/tiendas/${n.id}/miembros/me`,
            { token },
          );
          let ubicacionNombre: string | null = null;
          if (miembro.ubicacionId) {
            try {
              const u = await httpClient.get<ApiUbicacion>(
                `/tiendas/${n.id}/ubicaciones/${miembro.ubicacionId}`,
                { token },
              );
              ubicacionNombre = u.nombre;
            } catch {
              ubicacionNombre = null;
            }
          }
          let usarControlCaja = false;
          try {
            const det = await httpClient.get<ApiNegocioDetalle>(
              `/tiendas/${n.id}`,
              { token },
            );
            usarControlCaja = det.usarControlCaja === true;
          } catch {
            usarControlCaja = false;
          }
          return Tienda.create({
            id: n.id,
            nombre: n.name,
            rol: miembro.rol,
            ubicacionId: miembro.ubicacionId,
            ubicacionNombre,
            usarControlCaja,
          });
        } catch {
          return null;
        }
      }),
    );

    return resultados.filter((x): x is Tienda => x !== null);
  }
}
