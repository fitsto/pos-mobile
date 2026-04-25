/**
 * Banner compacto que avisa si estamos sin red o si hay operaciones en cola.
 * Se renderiza `null` cuando todo está normal (online y sin cola).
 */
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import {
    selectPendingCount,
    useOfflineQueueStore,
} from '../stores/OfflineQueueStore';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './ui';

export function OfflineBanner() {
    const t = useTheme();
    const online = useOfflineQueueStore((s) => s.online);
    const sincronizando = useOfflineQueueStore((s) => s.sincronizando);
    const pendingCount = useOfflineQueueStore(selectPendingCount);

    const offline = online === false;
    const hayCola = pendingCount > 0;
    if (!offline && !hayCola && !sincronizando) return null;

    const bg = offline ? t.color.feedback.dangerBg : t.color.feedback.warningBg;
    const fg = offline ? t.color.feedback.dangerFg : t.color.feedback.warningFg;
    const iconName: React.ComponentProps<typeof Ionicons>['name'] = offline
        ? 'cloud-offline-outline'
        : sincronizando
            ? 'sync-outline'
            : 'cloud-upload-outline';
    const msg = offline
        ? hayCola
            ? `Sin conexión · ${pendingCount} op${pendingCount === 1 ? '' : 's'} en cola`
            : 'Sin conexión · tus cambios se guardan localmente'
        : sincronizando
            ? `Sincronizando ${pendingCount} operación${pendingCount === 1 ? '' : 'es'}...`
            : `${pendingCount} operación${pendingCount === 1 ? '' : 'es'} en cola`;

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space['2'],
                paddingVertical: t.space['2'],
                paddingHorizontal: t.space['3'],
                borderRadius: t.radius.md,
                borderWidth: t.border.default,
                borderColor: fg,
                backgroundColor: bg,
                marginVertical: t.space['2'],
            }}
        >
            <Ionicons name={iconName} size={16} color={fg} />
            <Text variant="bodySm" style={{ color: fg, fontWeight: '700', flex: 1 }}>
                {msg}
            </Text>
        </View>
    );
}
