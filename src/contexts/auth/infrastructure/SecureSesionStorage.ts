import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SesionStorage } from '../domain/AuthRepository';
import { Sesion, type SesionData } from '../domain/Sesion';

const KEY = 'pos-negocios.sesion';

/**
 * Abstracción de storage: en native usa expo-secure-store (Keychain/Keystore),
 * en web cae a localStorage porque SecureStore no está disponible en el browser.
 */
interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

const webKV: KV = {
  async get(key) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  async set(key, value) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  async del(key) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

const nativeKV: KV = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  del: (key) => SecureStore.deleteItemAsync(key),
};

const kv: KV = Platform.OS === 'web' ? webKV : nativeKV;

export class SecureSesionStorage implements SesionStorage {
  async guardar(sesion: Sesion): Promise<void> {
    await kv.set(KEY, JSON.stringify(sesion.toJSON()));
  }

  async cargar(): Promise<Sesion | null> {
    const raw = await kv.get(KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as SesionData;
      return Sesion.create(data);
    } catch {
      await kv.del(KEY);
      return null;
    }
  }

  async limpiar(): Promise<void> {
    await kv.del(KEY);
  }
}
