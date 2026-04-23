import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '../../src/runtime/theme/tokens';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import {
  selectPendingCount,
  useOfflineQueueStore,
} from '../../src/runtime/stores/OfflineQueueStore';

function TabIcon({ label }: { label: string }) {
  return <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>{label}</Text>;
}

function TabIconConBadge({ label, badge }: { label: string; badge: number }) {
  return (
    <View style={{ position: 'relative' }}>
      <TabIcon label={label} />
      {badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -6,
            right: -12,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            borderRadius: 8,
            backgroundColor: '#e11d48',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const negocio = useSesionStore((s) => s.negocio);
  const esVendedor = negocio?.rol === 'VENDEDOR';
  const pendingCount = useOfflineQueueStore(selectPendingCount);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="pos"
        options={{ title: 'POS', tabBarIcon: () => <TabIcon label="POS" /> }}
      />
      <Tabs.Screen
        name="historial"
        options={{ title: 'Historial', tabBarIcon: () => <TabIcon label="HX" /> }}
      />
      <Tabs.Screen
        name="caja"
        options={{ title: 'Caja', tabBarIcon: () => <TabIcon label="$$" /> }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarIcon: () => <TabIcon label="STK" />,
          href: esVendedor ? null : '/stock',
        }}
      />
      <Tabs.Screen
        name="pendientes"
        options={{
          title: 'Pendientes',
          tabBarIcon: () => <TabIconConBadge label="SYNC" badge={pendingCount} />,
          // Solo visible cuando hay operaciones encoladas.
          // Cast: expo-router typed routes no regenera hasta rebuild.
          href: (pendingCount > 0 ? '/pendientes' : null) as never,
        }}
      />
      <Tabs.Screen
        name="cuenta"
        options={{ title: 'Cuenta', tabBarIcon: () => <TabIcon label="YO" /> }}
      />
    </Tabs>
  );
}
