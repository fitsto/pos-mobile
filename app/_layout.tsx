import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';

import { container } from '../src/runtime/di/container';
import { useSesionStore } from '../src/runtime/stores/SesionStore';
import { ThemeProvider, useTheme } from '../src/runtime/theme/ThemeProvider';
import { setUnauthorizedHandler } from '../src/contexts/shared/infrastructure/http/HttpClient';
import { sessionMonitor } from '../src/contexts/auth/application/SessionMonitor';
import { SessionWarningModal } from '../src/runtime/components/SessionWarningModal';
import { initOfflineQueue, tryDrainQueue } from '../src/runtime/offline/OfflineQueueManager';
import { initCatalogoSync, trySyncCatalogo } from '../src/runtime/catalogo/CatalogoSyncManager';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

/**
 * Map entre nombre lógico (`fontFamily.display` = 'BricolageGrotesque') +
 * peso RN (`fontWeight: '700'`) y el archivo concreto cargado por expo-font.
 *
 * expo-font no soporta `fontWeight` nativo con fuentes custom — cada peso es
 * un nombre de familia separado. Los primitivos resuelven el nombre exacto a
 * partir del tipo semántico, no se usa `fontWeight` en componentes.
 */
function useAppFonts() {
  return useFonts({
    // Bricolage Grotesque — display
    BricolageGrotesque: BricolageGrotesque_400Regular,
    'BricolageGrotesque-SemiBold': BricolageGrotesque_600SemiBold,
    'BricolageGrotesque-Bold': BricolageGrotesque_700Bold,
    // IBM Plex Sans — body
    IBMPlexSans: IBMPlexSans_400Regular,
    'IBMPlexSans-Medium': IBMPlexSans_500Medium,
    'IBMPlexSans-SemiBold': IBMPlexSans_600SemiBold,
    'IBMPlexSans-Bold': IBMPlexSans_700Bold,
    // IBM Plex Mono — precios/SKUs
    IBMPlexMono: IBMPlexMono_400Regular,
    'IBMPlexMono-Medium': IBMPlexMono_500Medium,
  });
}

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

  useEffect(() => {
    if (sesion?.expiresAt) {
      sessionMonitor.schedule(sesion.expiresAt);
    }
  }, [sesion]);

  useEffect(() => {
    void initOfflineQueue();
    void initCatalogoSync();
  }, []);

  useEffect(() => {
    if (sesion?.token) {
      void tryDrainQueue();
      void trySyncCatalogo();
    }
  }, [sesion?.token]);

  useProtectedRoute();
  return <>{children}</>;
}

/** Shell interior — vive dentro del ThemeProvider, resuelve colores del stack. */
function AppShell() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg.canvas }}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <SesionBootstrap>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.color.bg.raised },
            headerTintColor: theme.color.fg.primary,
            headerTitleStyle: {
              fontFamily: theme.font.body,
              fontWeight: '600',
              fontSize: 17,
            },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.color.bg.canvas },
            animation: 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="seleccionar-negocio" options={{ title: 'Elige tu tienda' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="producto/ajustar" options={{ headerShown: false }} />
          <Stack.Screen name="producto/nuevo" options={{ headerShown: false }} />
          <Stack.Screen name="producto/[id]" options={{ headerShown: false }} />
        </Stack>
        <SessionWarningModal />
      </SesionBootstrap>
    </View>
  );
}

/** Splash mientras cargan las fuentes. Minimal — no debería tardar. */
function FontSplash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF9' }}>
      <ActivityIndicator size="small" color="#0A0A0A" />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();

  // Si fallan las fuentes igual renderizamos — RN cae al system font.
  const listo = fontsLoaded || !!fontError;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>{listo ? <AppShell /> : <FontSplash />}</QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
