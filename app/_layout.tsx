import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View } from 'react-native';

import { container } from '../src/runtime/di/container';
import { useSesionStore } from '../src/runtime/stores/SesionStore';
import { colors } from '../src/runtime/theme/tokens';
import { setUnauthorizedHandler } from '../src/contexts/shared/infrastructure/http/HttpClient';
import { sessionMonitor } from '../src/contexts/auth/application/SessionMonitor';
import { SessionWarningModal } from '../src/runtime/components/SessionWarningModal';
import { initOfflineQueue, tryDrainQueue } from '../src/runtime/offline/OfflineQueueManager';
import { initCatalogoSync, trySyncCatalogo } from '../src/runtime/catalogo/CatalogoSyncManager';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const { sesion, negocio, cargando } = useSesionStore();

  useEffect(() => {
    if (cargando) return;
    const first = segments[0];
    const enAuth = first === '(auth)' || first === undefined;

    if (!sesion && !enAuth) {
      router.replace('/login');
    } else if (sesion && !negocio && first !== 'seleccionar-negocio') {
      router.replace('/seleccionar-negocio');
    } else if (sesion && negocio && (enAuth || first === 'seleccionar-negocio' || first === undefined)) {
      router.replace('/(tabs)/pos');
    }
  }, [sesion, negocio, cargando, segments, router]);
}

function SesionBootstrap({ children }: { children: React.ReactNode }) {
  const { sesion, setSesion, setCargando, reset } = useSesionStore();

  useEffect(() => {
    let activo = true;
    container.restaurarSesion
      .execute()
      .then((s) => activo && setSesion(s))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [setSesion, setCargando]);

  // Cualquier request con token que vuelva 401 => sesión expirada => limpiamos
  // todo y el guard de ruta redirige a /login automáticamente.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      container.logout.execute().catch(() => undefined);
      sessionMonitor.clear();
      reset();
    });
    return () => setUnauthorizedHandler(null);
  }, [reset]);

  // Reprograma el monitor cada vez que la sesión cambia (login, refresh, boot).
  useEffect(() => {
    if (sesion?.expiresAt) {
      sessionMonitor.schedule(sesion.expiresAt);
    }
  }, [sesion]);

  // Inicializa la cola offline y el catálogo local (SQLite + NetInfo) una sola vez.
  useEffect(() => {
    void initOfflineQueue();
    void initCatalogoSync();
  }, []);

  // Cuando aparece una sesión, intentamos drenar la cola y sincronizar catálogo.
  useEffect(() => {
    if (sesion?.token) {
      void tryDrainQueue();
      void trySyncCatalogo();
    }
  }, [sesion?.token]);

  useProtectedRoute();
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <SesionBootstrap>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="seleccionar-negocio" options={{ title: 'Elegí un negocio' }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <SessionWarningModal />
          </SesionBootstrap>
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
