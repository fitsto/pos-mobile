import type { Sesion } from './Sesion';

export interface LoginCredenciales {
  email: string;
  password: string;
}

export interface RefreshSessionResult {
  token: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthRepository {
  login(creds: LoginCredenciales): Promise<Sesion>;
  refresh(refreshToken: string): Promise<RefreshSessionResult>;
}

export interface SesionStorage {
  guardar(sesion: Sesion): Promise<void>;
  cargar(): Promise<Sesion | null>;
  limpiar(): Promise<void>;
}
