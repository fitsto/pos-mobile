import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '../../src/runtime/theme/tokens';
import {
  useOfflineQueueStore,
  selectFailedCount,
} from '../../src/runtime/stores/OfflineQueueStore';
import { offlineQueue, tryDrainQueue } from '../../src/runtime/offline/OfflineQueueManager';
import type { PendingOperation } from '../../src/contexts/offline-queue/domain/PendingOperation';

function tipoLabel(t: PendingOperation['type']): string {
  switch (t) {
    case 'AJUSTE_STOCK':
      return 'Ajuste de stock';
    case 'TRANSFERIR_STOCK':
      return 'Transferencia de stock';
    default:
      return t;
  }
}

function statusStyle(s: PendingOperation['status']) {
  switch (s) {
    case 'failed':
      return { color: colors.danger, label: 'ERROR' };
    case 'syncing':
      return { color: colors.accent, label: 'SINCRONIZANDO' };
    default:
      return { color: colors.textMuted, label: 'EN COLA' };
  }
}

function formatHora(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function PendientesScreen() {
  const operaciones = useOfflineQueueStore((s) => s.operaciones);
  const online = useOfflineQueueStore((s) => s.online);
  const sincronizando = useOfflineQueueStore((s) => s.sincronizando);
  const failedCount = useOfflineQueueStore(selectFailedCount);
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => {
    void offlineQueue.refreshStore();
  }, []);

  const sincronizar = useCallback(async () => {
    setRefrescando(true);
    try {
      await tryDrainQueue();
    } finally {
      setRefrescando(false);
    }
  }, []);

  const reintentar = async (op: PendingOperation) => {
    await offlineQueue.retryOperation(op.id);
  };

  const descartar = (op: PendingOperation) => {
    Alert.alert(
      'Descartar operación',
      `¿Seguro que querés descartar "${op.label}"? Los datos locales se perderán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            void offlineQueue.discardOperation(op.id);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={sincronizar} tintColor={colors.text} />}
      >
        <Text style={styles.title}>Operaciones pendientes</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusLine}>
            Conexión:{' '}
            <Text style={{ color: online === false ? colors.danger : colors.success, fontWeight: '700' }}>
              {online === false ? 'SIN RED' : online === true ? 'ONLINE' : '...'}
            </Text>
          </Text>
          <Text style={styles.statusLine}>En cola: {operaciones.length}</Text>
          {failedCount > 0 && (
            <Text style={[styles.statusLine, { color: colors.danger }]}>
              Con error: {failedCount}
            </Text>
          )}
          {sincronizando && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.statusLine}>Sincronizando...</Text>
            </View>
          )}
        </View>

        {operaciones.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Todo al día</Text>
            <Text style={styles.emptyBody}>
              No hay operaciones pendientes de sincronización.
            </Text>
          </View>
        )}

        {operaciones.map((op) => {
          const s = statusStyle(op.status);
          return (
            <View key={op.id} style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.rowTitle}>{op.label}</Text>
                <Text style={styles.rowMeta}>
                  {tipoLabel(op.type)} · {formatHora(op.createdAt)}
                </Text>
                <Text style={[styles.rowStatus, { color: s.color }]}>
                  {s.label}
                  {op.attempts > 0 ? ` · ${op.attempts} intentos` : ''}
                </Text>
                {op.lastError && (
                  <Text style={styles.rowError} numberOfLines={3}>
                    {op.lastError}
                  </Text>
                )}
              </View>
              <View style={{ gap: spacing.xs }}>
                {op.status === 'failed' && (
                  <Pressable onPress={() => reintentar(op)} style={[styles.btn, styles.btnPrimary]}>
                    <Text style={styles.btnText}>Reintentar</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => descartar(op)} style={[styles.btn, styles.btnDanger]}>
                  <Text style={styles.btnText}>Descartar</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {operaciones.length > 0 && online !== false && (
          <Pressable onPress={sincronizar} style={[styles.btn, styles.btnPrimary, { alignSelf: 'stretch', marginTop: spacing.md }]}>
            <Text style={styles.btnText}>Sincronizar ahora</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { ...type.display, color: colors.text },
  statusCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  statusLine: { color: colors.text, fontSize: 14 },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: { ...type.title, color: colors.text },
  emptyBody: { color: colors.textMuted, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  rowTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
  rowStatus: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  rowError: { color: colors.danger, fontSize: 12, marginTop: 4 },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnDanger: { backgroundColor: colors.danger },
  btnText: { color: '#000', fontWeight: '700', fontSize: 13 },
});
