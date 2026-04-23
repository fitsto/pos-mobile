export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string | null;
}

export interface SesionData {
  token: string;
  /** Refresh token legacy (no aplica con identity-central Better Auth; se mantiene opcional por compat de tipo). */
  refreshToken?: string;
  /** Unix seconds cuando expira el access token */
  expiresAt?: number;
  usuario: UsuarioSesion;
}

export class Sesion {
  private constructor(private readonly data: SesionData) {}

  static create(data: SesionData): Sesion {
    if (!data.token) throw new Error('Sesion requiere token');
    if (!data.usuario?.id) throw new Error('Sesion requiere usuario con id');
    return new Sesion({
      token: data.token,
      refreshToken: data.refreshToken ?? '',
      expiresAt: data.expiresAt ?? 0,
      usuario: data.usuario,
    });
  }

  get token(): string {
    return this.data.token;
  }

  get refreshToken(): string {
    return this.data.refreshToken ?? '';
  }

  get expiresAt(): number {
    return this.data.expiresAt ?? 0;
  }

  get usuario(): UsuarioSesion {
    return this.data.usuario;
  }

  toJSON(): SesionData {
    return {
      token: this.data.token,
      refreshToken: this.data.refreshToken,
      expiresAt: this.data.expiresAt,
      usuario: { ...this.data.usuario },
    };
  }
}
