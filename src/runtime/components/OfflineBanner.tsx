import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';
import {
  selectPendingCount,
  useOfflineQueueStore,
} from '../stores/OfflineQueueStore';

/**
 * Banner compacto que avisa si estamos sin red o si hay operaciones en cola.
 * Se renderiza `null` cuando todo está normal (online y sin cola).
 */
export function OfflineBanner() {
  const online = useOfflineQueueStore((s) => s.online);
  const sincronizando = useOfflineQueueStore((s) => s.sincronizando);
  const pendingCount = useOfflineQueueStore(selectPendingCount);

  const offline = online === false;
  const hayCola = pendingCount > 0;
  if (!offline && !hayCola && !sincronizando) return null;

  const bg = offline ? colors.danger : colors.accentDark;
  const msg = offline
    ? hayCola
      ? `Sin conexión · ${pendingCount} op${pendingCount === 1 ? '' : 's'} en cola`
      : 'Sin conexión · tus cambios se guardan localmente'
    : sincronizando
      ? `Sincronizando ${pendingCount} operación${pendingCount === 1 ? '' : 'es'}...`
      : `${pendingCount} operación${pendingCount === 1 ? '' : 'es'} en cola`;

  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={styles.text}>{msg}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
