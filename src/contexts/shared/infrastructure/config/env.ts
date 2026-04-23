import Constants from 'expo-constants';
import { Platform } from 'react-native';

interface EnvConfig {
  apiUrl: string;
  identityUrl: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<EnvConfig>;

/**
 * En un dispositivo físico o emulador, `localhost` apunta al propio teléfono,
 * no al PC donde corre el backend. Detectamos la IP LAN que Expo usa para
 * servir Metro (via `hostUri`) y la reutilizamos para las APIs.
 */
function hostLan(): string | null {
  const hostUri =
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ??
    null;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

function resolverUrl(configurado: string | undefined, portPorDefecto: string): string {
  if (configurado && !/localhost|127\.0\.0\.1/.test(configurado)) {
    return configurado;
  }

  let port = portPorDefecto;
  try {
    if (configurado) port = new URL(configurado).port || portPorDefecto;
  } catch {
    // ignore
  }

  if (Platform.OS === 'web') {
    return configurado ?? `http://localhost:${port}`;
  }

  const host = hostLan();
  if (host) return `http://${host}:${port}`;

  return configurado ?? `http://localhost:${port}`;
}

export const env: EnvConfig = {
  apiUrl:      resolverUrl(extra.apiUrl, '3001'),
  identityUrl: resolverUrl(extra.identityUrl, '3002'),
};
