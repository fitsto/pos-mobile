import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '../../src/runtime/theme/tokens';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { container } from '../../src/runtime/di/container';

export default function CuentaScreen() {
  const sesion = useSesionStore((s) => s.sesion);
  const negocio = useSesionStore((s) => s.negocio);
  const reset = useSesionStore((s) => s.reset);
  const setNegocio = useSesionStore((s) => s.setNegocio);

  async function logout() {
    await container.logout.execute();
    reset();
  }

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Mi cuenta</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Usuario</Text>
        <Text style={styles.value}>{sesion?.usuario.email}</Text>
        <Text style={styles.label}>Tienda</Text>
        <Text style={styles.value}>{negocio?.nombre}</Text>
        <Text style={styles.label}>Rol</Text>
        <Text style={styles.value}>{negocio?.rol}</Text>
        {negocio?.ubicacionNombre ? (
          <>
            <Text style={styles.label}>Ubicación</Text>
            <Text style={styles.value}>{negocio.ubicacionNombre}</Text>
          </>
        ) : null}
      </View>

      <Pressable onPress={() => setNegocio(null)} style={styles.secondary}>
        <Text style={styles.secondaryText}>Cambiar de negocio</Text>
      </Pressable>
      <Pressable onPress={logout} style={styles.danger}>
        <Text style={styles.dangerText}>Cerrar sesión</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.lg },
  title: { ...type.display, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: { ...type.label, color: colors.textMuted },
  value: { ...type.body, color: colors.text, marginBottom: spacing.sm },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
  danger: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dangerText: { color: colors.danger, fontWeight: '700' },
});
