import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, type } from '../theme/tokens';
import { sessionMonitor } from '../../contexts/auth/application/SessionMonitor';
import { container } from '../di/container';
import { useSesionStore } from '../stores/SesionStore';
import { Sesion } from '../../contexts/auth/domain/Sesion';
import { SecureSesionStorage } from '../../contexts/auth/infrastructure/SecureSesionStorage';

const storage = new SecureSesionStorage();

function secondsUntil(expiresAt: number | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor(expiresAt - Date.now() / 1000));
}

function formatMMSS(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SessionWarningModal() {
  const { sesion, setSesion, reset } = useSesionStore();
  const [open, setOpen] = useState(false);
  const [renovando, setRenovando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsubscribe = sessionMonitor.subscribe((event) => {
      if (event === 'warn') {
        setError(null);
        setRenovando(false);
        setOpen(true);
        setCountdown(secondsUntil(sessionMonitor.getExpiresAt()));
      } else if (event === 'expire') {
        setOpen(false);
        forzarLogout();
      } else if (event === 'clear') {
        setOpen(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!open) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = setInterval(() => {
      setCountdown(secondsUntil(sessionMonitor.getExpiresAt()));
    }, 1000);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [open]);

  const forzarLogout = () => {
    container.logout.execute().catch(() => undefined);
    sessionMonitor.clear();
    reset();
  };

  const mantenerSesion = async () => {
    if (!sesion?.refreshToken) {
      forzarLogout();
      return;
    }
    setRenovando(true);
    setError(null);
    try {
      const res = await container.refreshSession.execute(sesion.refreshToken);
      const nueva = Sesion.create({
        token: res.token,
        refreshToken: res.refreshToken,
        expiresAt: res.expiresAt,
        usuario: sesion.usuario,
      });
      await storage.guardar(nueva);
      setSesion(nueva);
      sessionMonitor.schedule(res.expiresAt);
      setOpen(false);
    } catch {
      setError('No se pudo renovar la sesión. Ingresá nuevamente.');
      setTimeout(forzarLogout, 1500);
    } finally {
      setRenovando(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Tu sesión está por expirar</Text>
          <Text style={styles.body}>
            Por seguridad, tu sesión se cerrará en{' '}
            <Text style={styles.countdown}>{formatMMSS(countdown)}</Text>.
            ¿Querés mantenerla activa o salir?
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable
              onPress={forzarLogout}
              disabled={renovando}
              style={[styles.btn, styles.btnGhost, renovando && styles.btnDisabled]}
            >
              <Text style={styles.btnGhostText}>Salir</Text>
            </Pressable>
            <Pressable
              onPress={mantenerSesion}
              disabled={renovando}
              style={[styles.btn, styles.btnPrimary, renovando && styles.btnDisabled]}
            >
              {renovando ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.btnPrimaryText}>Mantener sesión</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  title: { ...type.title, color: colors.text },
  body: { ...type.body, color: colors.textMuted },
  countdown: { color: colors.text, fontWeight: '800' },
  error: { ...type.body, color: colors.danger },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnGhostText: { ...type.body, color: colors.text, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { ...type.body, color: colors.bg, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});
