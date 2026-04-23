import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { container } from '../../src/runtime/di/container';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { colors, radius, spacing, type } from '../../src/runtime/theme/tokens';
import { DomainError } from '../../src/contexts/shared/domain/DomainError';
import { HttpError } from '../../src/contexts/shared/infrastructure/http/HttpClient';
import { env } from '../../src/contexts/shared/infrastructure/config/env';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const setSesion = useSesionStore((s) => s.setSesion);

  async function onSubmit() {
    setError(null);
    setCargando(true);
    try {
      const sesion = await container.login.execute({ email, password });
      setSesion(sesion);
    } catch (err) {
      let msg: string;
      if (err instanceof DomainError) {
        msg = err.message;
      } else if (err instanceof HttpError) {
        msg = err.status === 401 ? 'Credenciales inválidas' : `Error del servidor (HTTP ${err.status})`;
      } else if (err instanceof Error) {
        msg = `No se pudo conectar a ${env.apiUrl}: ${err.message}`;
      } else {
        msg = 'Error desconocido';
      }
      setError(msg);
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark} />
            <Text style={styles.brandText}>POS</Text>
          </View>
          <Text style={styles.title}>Ingresá a tu caja</Text>
          <Text style={styles.subtitle}>Usá el mail y contraseña de tu cuenta del negocio.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="vos@negocio.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              accessibilityLabel="Email"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
              accessibilityLabel="Contraseña"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={cargando}
            style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, cargando && styles.submitDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Ingresar"
          >
            {cargando ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.submitText}>Ingresar</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xxl },
  brandMark: { width: 28, height: 28, backgroundColor: colors.accent, borderRadius: radius.sm, transform: [{ rotate: '45deg' }] },
  brandText: { ...type.display, color: colors.text, letterSpacing: 4 },
  title: { ...type.display, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...type.body, color: colors.textMuted, marginBottom: spacing.xl },
  field: { marginBottom: spacing.lg },
  label: { ...type.label, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  error: { color: colors.danger, marginBottom: spacing.md, ...type.body },
  submit: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitPressed: { backgroundColor: colors.accentDark },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
