/**
 * Layout de tabs inferiores. Iconos de Ionicons, colores reactivos al theme,
 * badge de pendientes de sync sobre la tab "Pendientes".
 */
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    selectPendingCount,
    useOfflineQueueStore,
} from '../../src/runtime/stores/OfflineQueueStore';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useTheme } from '../../src/runtime/theme/ThemeProvider';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
}

function TabIconConBadge({
    name,
    color,
    size,
    badge,
}: {
    name: IoniconName;
    color: string;
    size: number;
    badge: number;
}) {
    const t = useTheme();
    return (
        <View style={{ position: 'relative' }}>
            <Ionicons name={name} color={color} size={size} />
            {badge > 0 ? (
                <View
                    style={{
                        position: 'absolute',
                        top: -4,
                        right: -10,
                        minWidth: 16,
                        height: 16,
                        paddingHorizontal: 4,
                        borderRadius: 8,
                        backgroundColor: t.color.feedback.dangerFg,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Text
                        style={{
                            color: t.color.fg.onAccent,
                            fontFamily: t.font.body,
                            fontSize: 10,
                            fontWeight: '700',
                        }}
                    >
                        {badge > 9 ? '9+' : badge}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

export default function TabsLayout() {
    const t = useTheme();
    const insets = useSafeAreaInsets();
    const negocio = useSesionStore((s) => s.negocio);
    const esVendedor = negocio?.rol === 'VENDEDOR';
    const pendingCount = useOfflineQueueStore(selectPendingCount);

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: t.color.accent.default,
                tabBarInactiveTintColor: t.color.fg.tertiary,
                tabBarStyle: {
                    backgroundColor: t.color.bg.raised,
                    borderTopColor: t.color.border.subtle,
                    borderTopWidth: t.border.default,
                    height: 64 + insets.bottom,
                    paddingTop: 6,
                    paddingBottom: 8 + insets.bottom,
                },
                tabBarLabelStyle: {
                    fontFamily: t.font.body,
                    fontSize: 11,
                    fontWeight: '600',
                    letterSpacing: 0.2,
                },
                headerStyle: { backgroundColor: t.color.bg.raised },
                headerTintColor: t.color.fg.primary,
                headerTitleStyle: { fontFamily: t.font.display, fontWeight: '700' },
            }}
        >
            <Tabs.Screen
                name="pos"
                options={{
                    title: 'POS',
                    headerShown: false,
                    tabBarIcon: ({ color, size }) => <TabIcon name="cart-outline" color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="historial"
                options={{
                    title: 'Historial',
                    tabBarIcon: ({ color, size }) => <TabIcon name="time-outline" color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="caja"
                options={{
                    title: 'Caja',
                    tabBarIcon: ({ color, size }) => <TabIcon name="cash-outline" color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="productos"
                options={{
                    title: 'Productos',
                    tabBarIcon: ({ color, size }) => <TabIcon name="cube-outline" color={color} size={size} />,
                    href: esVendedor ? null : '/productos',
                }}
            />
            <Tabs.Screen
                name="pendientes"
                options={{
                    title: 'Sync',
                    tabBarIcon: ({ color, size }) => (
                        <TabIconConBadge name="cloud-upload-outline" color={color} size={size} badge={pendingCount} />
                    ),
                    href: (pendingCount > 0 ? '/pendientes' : null) as never,
                }}
            />
            <Tabs.Screen
                name="cuenta"
                options={{
                    title: 'Cuenta',
                    tabBarIcon: ({ color, size }) => <TabIcon name="person-outline" color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
