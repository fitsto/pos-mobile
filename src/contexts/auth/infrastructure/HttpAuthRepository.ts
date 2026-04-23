import { identityClient } from '../../shared/infrastructure/http/HttpClient';
import type {
  AuthRepository,
  LoginCredenciales,
  RefreshSessionResult,
} from '../domain/AuthRepository';
import { Sesion } from '../domain/Sesion';

/**
 * Auth de operadores contra identity-central (Better Auth).
 *
 * React Native no maneja cookies de forma confiable, por lo que usamos el
 * plugin `bearer` del servidor: el sign-in devuelve el session token en el
 * body + en header `set-auth-token`, y mandamos ese token como
 * `Authorization: Bearer <sessionToken>` en requests subsiguientes.
 *
 * Semántica de campos en `Sesion`:
 *  - `token`        → JWT emitido por el plugin `jwt` (lo consume api-pos-negocios).
 *  - `refreshToken` → session token de Better Auth (lo consume identity-central
 *                     para emitir nuevos JWT cuando el actual expira).
 *  - `expiresAt`    → exp del JWT actual (Unix seconds).
 */

interface BetterAuthSignInResponse {
  // En algunas versiones viene `token` (session token) en el body.
  token?: string;
  user: {
    id:    string;
    email: string;
    name:  string | null;
  };
}

interface BetterAuthSessionResponse {
  user: { id: string; email: string; name: string | null };
}

interface BetterAuthTokenResponse {
  token: string; // JWT
}

function extraerExp(jwt: string): number {
  const parts = jwt.split('.');
  if (parts.length !== 3) return Math.floor(Date.now() / 1000) + 3600;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // atob disponible en RN moderno; fallback via Buffer si no.
    const json =
      typeof atob === 'function'
        ? atob(b64)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        : Buffer.from(b64, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { exp?: number };
    return payload.exp ?? Math.floor(Date.now() / 1000) + 3600;
  } catch {
    return Math.floor(Date.now() / 1000) + 3600;
  }
}

const AUTH_BASE = '/api/auth';

export class HttpAuthRepository implements AuthRepository {
  async login(creds: LoginCredenciales): Promise<Sesion> {
    // 1. sign-in: devuelve session token en header `set-auth-token` (bearer plugin).
    //    fetch en RN expone response.headers — el httpClient actual no nos da
    //    acceso al header, así que parseamos el body: Better Auth también
    //    incluye `token` en la respuesta de /sign-in/email cuando el bearer
    //    plugin está activo.
    const signIn = await identityClient.post<BetterAuthSignInResponse>(
      `${AUTH_BASE}/sign-in/email`,
      { email: creds.email, password: creds.password },
    );

    if (!signIn.token) {
      throw new Error('identity-central no devolvió session token — verificar plugin bearer()');
    }
    const sessionToken = signIn.token;

    // 2. Obtener JWT para APIs downstream.
    const { token: jwt } = await identityClient.get<BetterAuthTokenResponse>(
      `${AUTH_BASE}/token`,
      { token: sessionToken },
    );

    return Sesion.create({
      token:        jwt,
      refreshToken: sessionToken,
      expiresAt:    extraerExp(jwt),
      usuario: {
        id:     signIn.user.id,
        email:  signIn.user.email,
        nombre: signIn.user.name,
      },
    });
  }

  async refresh(refreshToken: string): Promise<RefreshSessionResult> {
    // `refreshToken` acá es el session token de Better Auth.
    if (!refreshToken) {
      throw new Error('No hay session token para refrescar');
    }
    const { token: jwt } = await identityClient.get<BetterAuthTokenResponse>(
      `${AUTH_BASE}/token`,
      { token: refreshToken },
    );

    // El session token sigue siendo el mismo (Better Auth lo rota
    // internamente; para simplificar lo reusamos). Podemos confirmar que
    // la sesión sigue viva consultando /get-session.
    await identityClient.get<BetterAuthSessionResponse>(
      `${AUTH_BASE}/get-session`,
      { token: refreshToken },
    );

    return {
      token:        jwt,
      refreshToken,
      expiresAt:    extraerExp(jwt),
    };
  }
}
