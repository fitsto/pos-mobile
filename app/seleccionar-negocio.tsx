import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { container } from '../src/runtime/di/container';
import { useSesionStore } from '../src/runtime/stores/SesionStore';
import { colors, radius, spacing, type } from '../src/runtime/theme/tokens';
import type { Tienda } from '../src/contexts/tienda/domain/Tienda';

export default function SeleccionarNegocioScreen() {
  const sesion = useSesionStore((s) => s.sesion);
  const setNegocio = useSesionStore((s) => s.setNegocio);
  const logout = useSesionStore((s) => s.reset);
  const [negocios, setNegocios] = useState<Tienda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sesion) return;
    container.listarMisNegocios
      .execute(sesion.token)
      .then((res) => {
        setNegocios(res);
        // Si el usuario tiene un único negocio, lo seleccionamos automáticamente
        // para saltar este paso — el guard del layout lo mandará a /(tabs)/pos.
        if (res.length === 1) {
          setNegocio(res[0]);
        }
      })
      .catch(() => setError('No pudimos traer tus negocios'))
      .finally(() => setCargando(false));
  }, [sesion, setNegocio]);

  async function cerrarSesion() {
    await container.logout.execute();
    logout();
  }

  if (cargando) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Elegí un negocio</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={negocios}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => setNegocio(item)}
            accessibilityRole="button"
            accessibilityLabel={`Seleccionar negocio ${item.nombre}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.nombre}</Text>
              <Text style={styles.cardMeta}>
                {item.rol}
                {item.ubicacionNombre ? ` · ${item.ubicacionNombre}` : ''}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No tenés negocios asignados.</Text>}
      />
      <Pressable onPress={cerrarSesion} style={styles.logout} accessibilityRole="button">
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { ...type.title, color: colors.text, padding: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardPressed: { borderColor: colors.accent },
  cardTitle: { ...type.title, color: colors.text, marginBottom: spacing.xs },
  cardMeta: { ...type.body, color: colors.textMuted },
  chev: { color: colors.accent, fontSize: 28, marginLeft: spacing.md },
  empty: { color: colors.textMuted, padding: spacing.lg },
  error: { color: colors.danger, paddingHorizontal: spacing.lg },
  logout: { padding: spacing.lg, alignItems: 'center' },
  logoutText: { color: colors.textMuted, ...type.body },
});
